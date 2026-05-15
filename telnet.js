import net from 'net';
import fs from 'fs';
import listaSwitches from './switches.js';

function gravarLogPuro(texto) {
    fs.appendFileSync('telnet.log', texto);
}

export async function consultarPorta(msg) {
    const partes = msg.trim().toLowerCase().split(/\s+/);
    const idIndex = parseInt(partes[0]); 
    let portaInput = partes.slice(1).join('').replace(/\s+/g, ''); 
    const sw = listaSwitches[idIndex];

    if (!sw) return `❌ Switch não localizado na posição ${idIndex}.`;

    let acao = 'sinal';
    if (portaInput === 'l') acao = 'listar';
    else if (portaInput.endsWith('?')) { acao = 'status'; portaInput = portaInput.replace('?', ''); }

    const dePara = { 
        'g': 'GigabitEthernet', 
        'x': 'XGigabitEthernet', 
        'q': '40GE', 
        'c': '100GE',
        'e': '25GigabitEthernet'
    };
    
    const prefixo = portaInput.charAt(0);
    let numero = portaInput.substring(1);
    if (acao !== 'listar' && !numero.includes('/')) numero = `0/0/${numero}`;
    const portaReal = `${dePara[prefixo] || 'GigabitEthernet'} ${numero}`;

    return new Promise((resolve) => {
        const client = new net.Socket();
        let buffer = '';
        let finalizado = false;
        let loginEtapa = 0;
        let comandoEnviado = false;

        if (fs.existsSync('telnet.log')) fs.truncateSync('telnet.log');

        const encerrar = () => {
            if (finalizado) return;
            finalizado = true;
            client.destroy();
            if (acao === 'listar') resolve(formatarListaGeral(sw.nome, buffer));
            else if (acao === 'status') resolve(formatarStatus(sw.nome, portaReal, buffer));
            else resolve(gerarRelatorio(sw.nome, portaReal, buffer));
        };

        client.connect(23, sw.ip);

        client.on('data', (data) => {
            const out = data.toString('binary');
            const cleanOut = out.replace(/[^\x20-\x7E\n\r\t]/g, '');
            buffer += cleanOut;
            gravarLogPuro(cleanOut);

            if (cleanOut.toLowerCase().includes('username') && loginEtapa === 0) {
                client.write(sw.usuario + '\r\n');
                loginEtapa = 1;
            } 
            else if (cleanOut.toLowerCase().includes('password') && loginEtapa === 1) {
                client.write(sw.senha + '\r\n');
                loginEtapa = 2;
            } 
            else if ((cleanOut.includes('<') || cleanOut.includes('[')) && loginEtapa === 2 && !comandoEnviado) {
                comandoEnviado = true;
                setTimeout(() => {
                    client.write('screen-length 0 temporary\r\n');
                    setTimeout(() => {
                        if (acao === 'listar') {
                            client.write('display interface description\r\n');
                        } else {
                            client.write(`display interface ${portaReal} | include Description\r\n`);
                            client.write(`display transceiver diagnosis interface ${portaReal} | begin Rx\r\n`);
                        }
                        const tempoEspera = acao === 'listar' ? 6000 : 3500;
                        setTimeout(() => {
                            client.write('quit\r\n');
                            setTimeout(encerrar, 1000);
                        }, tempoEspera);
                    }, 1000);
                }, 1000);
            }
        });

        client.on('error', () => encerrar());
        setTimeout(() => { if (!finalizado) encerrar(); }, 30000);
    });
}

function formatarListaGeral(nomeSw, log) {
    const linhas = log.split(/\r?\n/);
    let ethTrunks = [];
    let fisicas = [];

    linhas.forEach(l => {
        const match = l.match(/^([a-zA-Z0-9\/\.\-]+)\s+(up|down|\*down)\s+(up|down)\s+(.*)$/i);
        
        if (match) {
            const nomeInt = match[1];
            const phy = match[2].toLowerCase();
            const proto = match[3].toLowerCase();
            const desc = match[4].trim() || '---';
            
            let emoji = '🚫'; // Down/Down ou *Down/Down

            if (phy === 'up' && proto === 'up') {
                emoji = '✅';
            } else if (phy === 'up' && proto === 'down') {
                emoji = '🚨'; // Erro Camada 2: Físico OK, mas Protocolo Down
            }
            
            const linha = `${emoji} \`${nomeInt.padEnd(18)}\` \` | \`${phy}/${proto} | ${desc}`;

            if (nomeInt.toLowerCase().includes('trunk')) {
                ethTrunks.push(linha);
            } else if (!nomeInt.toLowerCase().includes('null') && !nomeInt.toLowerCase().includes('meth')) {
                fisicas.push(linha);
            }
        }
    });

    let msg = `📂 *RESUMO DE INTERFACES - ${nomeSw}*\n\n`;
    if (ethTrunks.length > 0) msg += `🔗 *ETH-TRUNKS*\n${ethTrunks.join('\n')}\n\n`;
    if (fisicas.length > 0) msg += `⚡ *INTERFACES FÍSICAS*\n${fisicas.join('\n')}`;

    return msg || "❌ Nenhuma interface capturada no log.";
}

function gerarRelatorio(nomeSw, porta, log) {
    const linhas = log.split(/\r?\n/);
    let lanes = [], limite = -13.64, desc = "---";
    const dLine = linhas.find(l => l.toLowerCase().includes('description:'));
    if (dLine) desc = dLine.split(':')[1]?.trim() || "---";

    let capturando = false;
    for (let l of linhas) {
        l = l.trim();
        if (/rx\s*power/i.test(l)) {
            capturando = true;
            const nums = l.match(/-?\d+\.\d+/g);
            if (nums) {
                lanes.push(parseFloat(nums[0]));
                const alarm = nums.find(n => parseFloat(n) <= -12.00);
                if (alarm) limite = parseFloat(alarm);
            }
            continue;
        }
        if (capturando) {
            if (/^(current|temp|voltage|----)/i.test(l)) break;
            const m = l.match(/^(-?\d+\.\d+)/);
            if (m) lanes.push(parseFloat(m[1]));
        }
    }
    lanes = [...new Set(lanes)].slice(0, 4).sort((a, b) => a - b);
    if (lanes.length === 0) return `❌ Sinal não localizado em ${nomeSw}\n*Porta:* ${porta}\n*Desc:* ${desc}`;
    
    const pior = lanes[0];
    const status = pior <= limite ? "🚨 *SINAL CRÍTICO*" : "✅ *SINAL NORMAL*";
    let msg = `📡 *SINAL (RX) - ${nomeSw}*\n*Porta:* ${porta}\n*Desc:* ${desc}\n────────────────\n`;
    lanes.forEach((v, i) => msg += `📶 Lane ${i}: ${v.toFixed(2)} dBm\n`);
    msg += `────────────────\n📉 Pior RX: ${pior.toFixed(2)} dBm\n📉 Limite: ${limite.toFixed(2)} dBm\n────────────────\n${status}`;
    return msg;
}

function formatarStatus(nomeSw, porta, log) {
    const linhas = log.split(/\r?\n/);
    let estado = "DOWN", protocolo = "DOWN", desc = "---";
    for (const l of linhas) {
        if (l.includes("current state :") && !l.includes("Line protocol")) estado = l.split(':')[1]?.trim();
        if (l.includes("Line protocol current state :")) protocolo = l.split(':')[1]?.trim();
        if (l.includes("Description:")) desc = l.split(':')[1]?.trim();
    }
    const emoji = (estado === "UP") ? "✅" : "🚨";
    return `${emoji} *STATUS INTERFACE*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n*Estado:* ${estado}\n*Protocolo:* ${protocolo}\n*Desc:* ${desc}`;
}
