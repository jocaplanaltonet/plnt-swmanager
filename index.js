import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { consultarPorta } from './telnet.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const { WPP_BASE_URL, WPP_TOKEN, PORTA_BOT } = process.env;
const PORT = PORTA_BOT || 21466;

let processando = false;
const fila = [];

const processarFila = async () => {
    if (processando || fila.length === 0) return;
    processando = true;
    const { body, sender } = fila.shift();

    try {
        console.log(`[FILA] Processando: ${body}`);
        const resultado = await consultarPorta(body);
        await enviarWpp(sender, resultado);
    } catch (error) {
        console.error(`[ERRO]`, error.message);
        await enviarWpp(sender, `⚠️ Erro técnico ao processar comando.`);
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

    // SEU MENU OFICIAL
    if (msgTexto === 'menu' || msgTexto === 'ajuda' || msgTexto === 'oi') {
        const meuMenu = `🖥️ *SISTEMA DE GESTÃO DE REDE*

*EQUIPAMENTOS:* *1* - SW-CORE _(S6730-H24X6C-100G)_
*2* - BKB_CARPINA _(S6730-H24X6C-100G)_
*3* - BKB_LCARRO _(S6730-H24X6C-100G)_
*4* - BKB_TRAC _(S6730-H24X6C-100G)_
*5* - BKB_NZM _(S6730-H24X6C-100G)_
*6* - BKB_LIMOEIRO _(S6730-H24X6C-100G)_
*7* - BKB_TIMBAUBA _(S5720-36C-EI-28S-DC)_
*8* - BKB_PDLH _(S6730-H24X6C-100G)_
*9* - BKB_VARZEA _(S6730-H24X6C-100G)_
*10* - BKB_ALIANCA _(S5720-36C-EI-28S-DC)_
*11* - SW-CAJA03 _(S5732-H24S6Q)_
*12* - SW-FH02 _(S5732-H24S6Q)_
*13* - SW-3MARIAS _(S5732-H24S6Q)_

────────────────
🔍 *CONSULTA DE SINAL RX:*
• \`ID\` + \`Porta\` (Ex: \`1 c1\`)

⚡ *COMANDOS DE INTERFACE:*
• *Status* (Up/Down) → \`ID\` + \`Porta?\` (Ex: \`1 c1?\`)
• *Shut* (Desligar)  → \`ID\` + \`Portas\` (Ex: \`1 c1s\`)
• *Up* (Religar)     → \`ID\` + \`Portau\` (Ex: \`1 c1u\`)

────────────────
📌 *LEGENDA:* c=100G, q=40G, x=10G, g=1G`;

        await enviarWpp(sender, meuMenu);
        return res.status(200).send('OK');
    }

    // REGEX DE COMANDOS TÉCNICOS
    if (/^\d+\s+[a-zA-Z\d?]+$/.test(msgTexto)) {
        fila.push({ body, sender });
        processarFila();
    }
    
    res.status(200).send('OK');
});

async function enviarWpp(to, text) {
    try {
        await axios.post(`${WPP_BASE_URL}/send-message`, { phone: to, message: text }, 
        { headers: { 'Authorization': `Bearer ${WPP_TOKEN}` } });
    } catch (err) {
        console.error("Erro WPP:", err.message);
    }
}

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Bot online na porta ${PORT}`));
