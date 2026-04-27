import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { consultarPorta } from './telnet.js';
import listaSwitches from './switches.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const { WPP_BASE_URL, WPP_TOKEN, PORTA_BOT, ALLOWED_CHATS } = process.env;
const PORT = PORTA_BOT || 21466;

// Converte a string do .env em um Array para validação
const chatsPermitidos = ALLOWED_CHATS ? ALLOWED_CHATS.split(',').map(id => id.trim()) : [];

let processando = false;
const fila = [];

const processarFila = async () => {
    if (processando || fila.length === 0) return;
    processando = true;
    const { body, sender } = fila.shift();

    try {
        console.log(`[FILA] Processando para ${sender}`);
        const resultado = await consultarPorta(body);
        
        // Verifica se o resultado é uma lista de mensagens (comando 'l')
        if (Array.isArray(resultado)) {
            for (const msg of resultado) {
                await enviarWpp(sender, msg);
                // Delay de 600ms entre as mensagens para garantir a ordem no WhatsApp
                await new Promise(r => setTimeout(r, 600));
            }
        } else if (resultado) {
            await enviarWpp(sender, resultado);
        }
    } catch (error) {
        console.error(`[ERRO FILA]`, error.message);
    } finally {
        processando = false;
        setTimeout(processarFila, 1000);
    }
};

app.post('/webhook', async (req, res) => {
    const { event, body, from, chatId, fromMe } = req.body;
    if (fromMe || event !== 'onmessage' || !body) return res.sendStatus(200);

    const msgTexto = body.trim().toLowerCase();
    const sender = from || chatId;

    // 🔒 TRAVA DE SEGURANÇA: Só atende os grupos do ALLOWED_CHATS
    if (chatsPermitidos.length > 0 && !chatsPermitidos.includes(sender)) {
        console.log(`[BLOQUEADO] Tentativa em chat não autorizado: ${sender}`);
        return res.sendStatus(200);
    }

    if (msgTexto === 'menu' || msgTexto === 'ajuda' || msgTexto === 'oi') {
        let listaTexto = "";
        listaSwitches.forEach((sw, index) => {
            listaTexto += `*${index + 1}* - ${sw.nome} _(${sw.modelo})_\n`;
        });

        const meuMenu = `🖥️ *SISTEMA DE GESTÃO DE REDE*
*EQUIPAMENTOS:*
${listaTexto.trim()}
⚡ *COMANDOS DE INTERFACE:*
• *Sinal:* \`ID\` + \`Porta\` (Ex: \`1 x1\`)
• *Status:* \`ID\` + \`Porta?\` (Ex: \`1 c1?\`)
• *Listar:* \`ID\` + \`l\` (Ex: \`1 l\`)
• *Shut:* \`ID\` + \`Portas\` (Ex: \`1 c1s\`)
• *Up:* \`ID\` + \`Portau\` (Ex: \`1 c1u\`)
📌 *LEG:* c=100G, q=40G, e=25G, x=10G, g=1G`;

        await enviarWpp(sender, meuMenu);
        return res.status(200).send('OK');
    }

    if (/^\d+\s+[a-zA-Z\d?]+$/.test(msgTexto)) {
        fila.push({ body, sender });
        processarFila();
    }
    res.status(200).send('OK');
});

async function enviarWpp(to, text) {
    try {
        const apenasNumeros = to.split('@')[0].split(':')[0];
        const eGrupo = to.includes('@g.us');

        await axios.post(`${WPP_BASE_URL}/send-message`, { 
            phone: apenasNumeros, 
            message: text,
            isGroup: eGrupo
        }, { 
            headers: { 
                'Authorization': `Bearer ${WPP_TOKEN}`,
                'Content-Type': 'application/json'
            } 
        });
        console.log(`[WPP] ✅ Enviado para ${to}`);
    } catch (err) {
        console.error(`[ERRO WPP] Destino: ${to}`);
    }
}

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Bot online na porta ${PORT}`));
