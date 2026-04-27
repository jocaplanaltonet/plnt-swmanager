import net from 'net';
import listaSwitches from './switches.js';

export async function consultarPorta(msg) {
    const partes = msg.trim().toLowerCase().split(/\s+/);
    const idIndex = parseInt(partes[0]) - 1;
    let portaInput = partes[1]; 
    const sw = listaSwitches[idIndex];

    if (!sw) return "❌ Switch não cadastrado.";

    let acao = 'sinal';
    if (portaInput === 'l') { acao = 'listar'; }
    else if (portaInput.endsWith('?')) { acao = 'status'; portaInput = portaInput.replace('?', ''); }
    else if (portaInput.endsWith('s')) { acao = 'shutdown'; portaInput = portaInput.slice(0, -1); }
    else if (portaInput.endsWith('u')) { acao = 'unshutdown'; portaInput = portaInput.slice(0, -1); }

    let portaReal = "";
    if (acao !== 'listar') {
        const dePara = { 'g': 'GigabitEthernet0/0/', 'x': 'XGigabitEthernet0/0/', 'q': '40GE0/0/', 'c': '100GE0/0/', 'e': '25GigabitEthernet0/0/' };
        const prefixo = portaInput.charAt(0);
        portaReal = (dePara[prefixo] || '') + portaInput.substring(1);
    }

    return new Promise((resolve) => {
        const client = new net.Socket();
        let buffer = '';
        let etapa = 'USUARIO';
        let finalizado = false;

        const processarEResolver = () => {
            if (finalizado) return;
            finalizado = true;
            client.destroy();
            if (acao === 'listar') resolve(formatarListaGeral(sw.nome, buffer));
            else if (acao === 'shutdown' || acao === 'unshutdown') resolve(formatarConfirmacao(sw.nome, portaReal, buffer, acao));
            else if (acao === 'status') resolve(interpretarStatus(sw.nome, portaReal, buffer));
            else resolve(gerarRelatorio(sw.nome, portaReal, buffer));
        };

        const timeout = setTimeout(() => {
            if (!finalizado) { client.destroy(); resolve(`❌ Timeout em ${sw.ip}`); }
        }, 35000);

        client.connect(23, sw.ip);

        client.on('data', (data) => {
            const out = data.toString('binary').replace(/[^\x20-\x7E\n\r\t]/g, '');
            buffer += out;

            if (etapa === 'USUARIO' && out.toLowerCase().includes('username')) {
                client.write(sw.usuario + '\r\n');
                etapa = 'SENHA';
            } 
            else if (etapa === 'SENHA' && out.toLowerCase().includes('password')) {
                client.write(sw.senha + '\r\n');
                etapa = 'COMANDOS';
            } 
            else if (etapa === 'COMANDOS' && (out.includes('<') || out.includes('['))) {
                etapa = 'RESPOSTA';
                client.write('screen-length 0 temporary\r\n');
                if (acao === 'listar') {
                    client.write('display interface description\r\n');
                    client.write('quit\r\n');
                } else if (acao === 'shutdown' || acao === 'unshutdown') {
                    const cmd = acao === 'shutdown' ? 'shutdown' : 'undo shutdown';
                    client.write('system-view\r\n');
                    setTimeout(() => client.write(`interface ${portaReal}\r\n`), 300);
                    setTimeout(() => client.write(`${cmd}\r\n`), 600);
                    setTimeout(() => client.write(`display this\r\n`), 900);
                    setTimeout(() => { client.write('return\r\n'); client.write('quit\r\n'); }, 1500);
                } else if (acao === 'status') {
                    client.write(`display interface brief | include ${portaReal}\r\n`);
                    client.write('quit\r\n');
                } else {
                    client.write(`display interface ${portaReal}\r\n`);
                    client.write(`display transceiver diagnosis interface ${portaReal}\r\n`);
                    client.write('quit\r\n');
                }
                const delay = (acao === 'listar') ? 10000 : 4500;
                setTimeout(processarEResolver, delay);
            }
        });

        client.on('error', (err) => {
            if (err.code === 'ECONNRESET' && buffer.length > 200) processarEResolver();
            else { client.destroy(); resolve(`❌ Erro: ${err.message}`); }
        });
    });
}

function formatarListaGeral(nomeSw, log) {
    const linhas = log.split(/\r?\n/);
    
    let grupos = {
        'TRUNKS': [],
        'VLANIFS': [],
        'FISICAS': []
    };

    linhas.forEach(linha => {
        const l = linha.trim();
        if (/^[a-zA-Z]/.test(l) && (l.includes(' up ') || l.includes(' down ') || l.includes(' *down '))) {
            const partes = l.split(/\s+/);
            const interfaceNome = partes[0];
            const phy = partes[1].toLowerCase();
            const protocol = partes[2].toLowerCase();
            let desc = partes.slice(3).join(' ').trim() || '---';

            // Definindo o Status Visual
            let emoji = (phy === 'up' && protocol === 'up') ? '✅' : (phy === 'up' ? '⚠️' : '❌');
            if (phy.includes('*down')) emoji = '🚫';

            const item = `${emoji} \`${interfaceNome.padEnd(15)}\` | \`${phy}/${protocol}\` | ${desc}`;

            // Classificação
            if (interfaceNome.toLowerCase().startsWith('eth-trunk')) grupos['TRUNKS'].push(item);
            else if (interfaceNome.toLowerCase().startsWith('vlanif')) grupos['VLANIFS'].push(item);
            else if (/^(XGE|100GE|25GE|GE|Gigabit|40GE)/i.test(interfaceNome)) grupos['FISICAS'].push(item);
        }
    });

    let mensagensSaida = [];
    
    // Montando Mensagem de Trunks
    if (grupos['TRUNKS'].length > 0) {
        let msg = `📂 *TRUNKS - ${nomeSw}*\n\`Interface       | PHY/PROT | Descrição\`\n` + grupos['TRUNKS'].join('\n');
        mensagensSaida.push(msg);
    }

    // Montando Mensagem de Vlanifs (com quebra se for muito longa)
    if (grupos['VLANIFS'].length > 0) {
        let msg = `🌐 *VLANIFS - ${nomeSw}*\n` + grupos['VLANIFS'].join('\n');
        // Se a vlanif for gigante, aqui podemos dar um slice, mas por enquanto vai em uma msg
        mensagensSaida.push(msg);
    }

    // Montando Mensagem de Físicas
    if (grupos['FISICAS'].length > 0) {
        let msg = `🔌 *FÍSICAS - ${nomeSw}*\n` + grupos['FISICAS'].join('\n');
        mensagensSaida.push(msg);
    }

    // Retorna um Array. O index.js vai precisar ser ajustado para enviar múltiplas msgs se for um array.
    return mensagensSaida.length > 0 ? mensagensSaida : "❌ Nenhuma interface encontrada.";
}

// Manter as outras funções iguais...
function formatarConfirmacao(nomeSw, porta, log, acao) {
    const partes = log.split(/display this/i);
    let configAtual = "Configuração não capturada.";
    if (partes.length > 1) configAtual = partes[1].split('return')[0].split('<')[0].split('[')[0].trim();
    const titulo = acao === 'shutdown' ? '🚫 PORTA DESLIGADA' : '✅ PORTA REATIVADA';
    return `⚡ *${titulo}*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n\n*Espelho:*\n\`\`\`\n${configAtual}\n\`\`\`\n────────────────`;
}

function interpretarStatus(nomeSw, porta, log) {
    const linhas = log.split(/\r?\n/);
    const linhaStatus = linhas.find(l => l.trim().startsWith(porta) && !l.includes('|') && !l.includes('display'));
    if (!linhaStatus) return `❌ Interface ${porta} não encontrada no ${nomeSw}.`;
    const colunas = linhaStatus.trim().split(/\s+/);
    const phy = colunas[1] ? colunas[1].toLowerCase() : 'n/a';
    const protocol = colunas[2] ? colunas[2].toLowerCase() : 'n/a';
    let emoji = '❓', msgResultado = `STATUS: ${phy.toUpperCase()}`;
    if (phy.includes('*down')) { emoji = '🚫'; msgResultado = 'PORTA DESLIGADA!'; }
    else if (phy === 'down') { emoji = '⚠️'; msgResultado = 'SEM LINK!'; }
    else if (phy === 'up' && protocol === 'up') { emoji = '✅'; msgResultado = 'LINK OPERACIONAL'; }
    return `🖥️ *STATUS TÉCNICO*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n────────────────\n${emoji} *${msgResultado}*\n────────────────\n*PHY:* ${phy}\n*PROT:* ${protocol}`;
}

function gerarRelatorio(nomeSw, porta, log) {
    const linhas = log.split(/\r?\n/);
    const descLine = linhas.find(l => l.toLowerCase().includes('description:'));
    const desc = descLine ? descLine.split(/description:/i)[1].trim() : "Sem descrição";
    let lanes = [], limite = -13.00, naSecaoRX = false;

    linhas.forEach(l => {
        const texto = l.toLowerCase();
        if (texto.includes('txpower')) naSecaoRX = false;
        if (texto.includes('rxpower')) naSecaoRX = true;
        if (naSecaoRX || texto.includes('rxpower')) {
            const matches = l.match(/([-+]?\d+\.\d+)/g); 
            if (matches) {
                const valor = parseFloat(matches[0]);
                if (valor > -40 && valor < 5) lanes.push(valor);
                if (texto.includes('rxpower')) {
                    let thresh = matches.length > 3 ? parseFloat(matches[3]) : (matches.length >= 2 ? parseFloat(matches[1]) : undefined);
                    if (thresh !== undefined && thresh < -5) limite = thresh;
                }
            }
        }
        if (texto.includes('current(ma)') || texto.includes('temp.')) naSecaoRX = false;
    });

    if (lanes.length === 0) return `❌ *Sinal RX não detectado* em ${nomeSw}\n🔌 *Porta:* ${porta}\n📝 *Desc:* ${desc}`;
    const lanesUnicas = [...new Set(lanes)].sort((a, b) => a - b);
    const piorRX = lanesUnicas[0];
    const statusTxt = piorRX <= limite ? '🚨 *SINAL CRÍTICO*' : '✅ *SINAL NORMAL*';
    let msg = `📡 *DIAGNÓSTICO DE SINAL (RX)*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n*Desc:* ${desc}\n────────────────\n`;
    if (lanesUnicas.length > 1) {
        lanesUnicas.forEach((v, i) => { msg += `📶 *Lane ${i}:* \`${v.toFixed(2)} dBm\`\n`; });
        msg += `────────────────\n📉 *Pior RX:* \`${piorRX.toFixed(2)} dBm\`\n`;
    } else { msg += `📶 *RX Power:* \`${lanesUnicas[0].toFixed(2)} dBm\`\n`; }
    msg += `📉 *Lim. Crítico:* \`${limite.toFixed(2)} dBm\`\n────────────────\n${statusTxt}`;
    return msg;
}
