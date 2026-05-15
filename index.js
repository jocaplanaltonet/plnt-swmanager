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

const chatsPermitidos = ALLOWED_CHATS ? ALLOWED_CHATS.split(',').map(id => id.trim()) : [];

let processando = false;
const fila = [];

const processarFila = async () => {
    if (processando || fila.length === 0) return;
    processando = true;
    
    const { body, sender } = fila.shift();

    try {
        console.log(`[FILA] Processando para ${sender}: ${body}`);
        
        // Passa o callback de progresso para enviar as atualizações parciais ao WhatsApp
        const resultado = await consultarPorta(body, async (msgProgresso) => {
            await enviarWpp(sender, msgProgresso);
        });
        
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
        setTimeout(processarFila, 1000);
    }
};

app.post('/webhook', async (req, res) => {
    const { event, body, from, chatId, fromMe } = req.body;
    
    if (fromMe || event !== 'onmessage' || !body) return res.sendStatus(200);

    const msgTexto = body.trim().toLowerCase();
    const sender = from || chatId;

    if (chatsPermitidos.length > 0 && !chatsPermitidos.includes(sender)) {
        console.log(`[BLOQUEADO] Tentativa de acesso por: ${sender}`);
        return res.sendStatus(200);
    }

    // 1. INTERCEPTA O MENU TRADICIONAL
    if (msgTexto === 'menu') {
        let listaTexto = "";
        listaSwitches.forEach((sw, index) => {
            const modeloSw = sw.modelo || "Huawei";
            const versaoSw = sw.versao ? `_(${sw.versao})_` : "";
            listaTexto += `*${index}* - ${sw.nome} — ${modeloSw} ${versaoSw}\n`;
        });

        const meuMenu = `🖥️ *PLNT-SWMANAGER | GESTÃO DE REDE*

*EQUIPAMENTOS:*
${listaTexto.trim()}

⚡ *COMANDOS DE INTERFACE:*
• *Sinal:* \`ID\` + \`Porta\` (Ex: \`0 x1\`)
• *Status:* \`ID\` + \`Porta?\` (Ex: \`0 c1?\`)
• *Listar:* \`ID\` + \`l\` (Ex: \`0 l\`)
• *Varredura de Versão:* \`menu update\`

📌 *LEG:* c=100G, q=40G, x=10G, g=1G`;

        await enviarWpp(sender, meuMenu);
        return res.sendStatus(200);
    }

    // 2. INTERCEPTA O COMANDO DE UPDATE E JOGA NA FILA SEQUENCIAL
    if (msgTexto === 'menu update' || msgTexto === 'update') {
        fila.push({ body: 'menu update', sender });
        processarFila();
        return res.sendStatus(200);
    }

    // 3. REGEX PARA COMANDOS TRADICIONAIS (Começando com número do ID do switch)
    const match = msgTexto.match(/^(\d+)\s*(.*)$/);
    if (match) {
        const id = match[1];
        const cmd = match[2].trim();

        if (id && cmd) {
            fila.push({ body: `${id} ${cmd}`, sender });
            processarFila();
        }
    }

    res.sendStatus(200);
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
        console.error(`[ERRO WPP] Destino: ${to} | Erro: ${err.message}`);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Webhook plnt-swmanager online na porta ${PORT}`);
});
