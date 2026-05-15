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

// Lista de JIDs autorizados vinda do .env
const chatsPermitidos = ALLOWED_CHATS ? ALLOWED_CHATS.split(',').map(id => id.trim()) : [];

let processando = false;
const fila = [];

const processarFila = async () => {
    if (processando || fila.length === 0) return;
    processando = true;
    
    const { body, sender } = fila.shift();

    try {
        console.log(`[FILA] Processando para ${sender}: ${body}`);
        const resultado = await consultarPorta(body);
        
        if (Array.isArray(resultado)) {
            for (const msg of resultado) {
                await enviarWpp(sender, msg);
                await new Promise(r => setTimeout(r, 600));
            }
        } else if (resultado) {
            await enviarWpp(sender, resultado);
        }
    } catch (error) {
        console.error(`[ERRO FILA]`, error.message);
    } finally {
        processando = false;
        // Pequeno intervalo entre itens da fila para evitar flood
        setTimeout(processarFila, 1000);
    }
};

app.post('/webhook', async (req, res) => {
    const { event, body, from, chatId, fromMe } = req.body;
    
    // Ignora mensagens próprias, eventos que não sejam mensagem ou corpo vazio
    if (fromMe || event !== 'onmessage' || !body) return res.sendStatus(200);

    const msgTexto = body.trim().toLowerCase();
    const sender = from || chatId;

    // Segurança: Bloqueia chats não autorizados (se a lista não estiver vazia)
    if (chatsPermitidos.length > 0 && !chatsPermitidos.includes(sender)) {
        console.log(`[BLOQUEADO] Tentativa de acesso por: ${sender}`);
        return res.sendStatus(200);
    }

    // COMANDO MENU: Ajustado para começar em 0
    if (msgTexto === 'menu') {
        let listaTexto = "";
        listaSwitches.forEach((sw, index) => {
            listaTexto += `*${index}* - ${sw.nome} _(${sw.modelo || 'Huawei'})_\n`;
        });

        const meuMenu = `🖥️ *SISTEMA DE GESTÃO DE REDE*

*EQUIPAMENTOS:*
${listaTexto.trim()}

⚡ *COMANDOS DE INTERFACE:*
• *Sinal:* \`ID\` + \`Porta\` (Ex: \`0 x1\`)
• *Status:* \`ID\` + \`Porta?\` (Ex: \`0 c1?\`)
• *Listar:* \`ID\` + \`l\` (Ex: \`0 l\`)
• *Config:* \`ID\` + \`Portaf\` (Ex: \`0 x1f\`)
• *Shut:* \`ID\` + \`Portas\` (Ex: \`0 c1s\`)
• *Up:* \`ID\` + \`Portau\` (Ex: \`0 c1u\`)

📌 *LEG:* c=100G, q=40G, x=10G, g=1G
_O sw-core agora é o ID 0._`;

        await enviarWpp(sender, meuMenu);
        return res.status(200).send('OK');
    }

    // REGEX: Aceita "0 x1", "13q1", etc.
    const match = msgTexto.match(/^(\d+)\s*(.*)$/);
    if (match) {
        const id = match[1];
        const cmd = match[2].trim();

        if (id && cmd) {
            // Normaliza a mensagem para a fila (garante espaço entre ID e Comando)
            fila.push({ body: `${id} ${cmd}`, sender });
            processarFila();
        }
    }

    res.status(200).send('OK');
});

async function enviarWpp(to, text) {
    try {
        // Limpeza simples do JID para o formato da API
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
        console.error(`[ERRO WPP] Destino: ${to} | Erro: ${err.message}`);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Webhook Planalto Net online na porta ${PORT}`);
});
