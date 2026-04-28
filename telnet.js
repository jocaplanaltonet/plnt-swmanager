import net from 'net';
import fs from 'fs';
import listaSwitches from './switches.js';

function gravarLogPuro(texto) {
    fs.appendFileSync('telnet.log', texto);
}

export async function consultarPorta(msg) {
    const partes = msg.trim().toLowerCase().split(/\s+/);
    const idIndex = parseInt(partes[0]) - 1;
    let portaInput = partes.slice(1).join('').replace(/\s+/g, ''); 
    const sw = listaSwitches[idIndex];

    if (!sw) return "❌ Switch não cadastrado.";

    let acao = 'sinal';
    if (portaInput === 'l') acao = 'listar';
    else if (portaInput.endsWith('?')) { acao = 'status'; portaInput = portaInput.replace('?', ''); }
    else if (portaInput.endsWith('s')) { acao = 'shutdown'; portaInput = portaInput.slice(0, -1); }
    else if (portaInput.endsWith('u')) { acao = 'unshutdown'; portaInput = portaInput.slice(0, -1); }
    else if (portaInput.endsWith('f')) { acao = 'full'; portaInput = portaInput.slice(0, -1); }

    let portaReal = "";
    if (acao !== 'listar') {
        const dePara = { 'g': 'GigabitEthernet', 'x': 'XGigabitEthernet', 'q': '40GE', 'c': '100GE', 'e': '25GigabitEthernet' };
        const prefixo = portaInput.charAt(0);
        let numero = portaInput.substring(1);
        if (!numero.includes('/')) numero = `0/0/${numero}`;
        portaReal = `${dePara[prefixo]} ${numero}`;
    }

    return new Promise((resolve) => {
        const client = new net.Socket();
        let buffer = '';
        let finalizado = false;
        let comandosEnviados = false;
        let loginEtapa = 0;

        if (fs.existsSync('telnet.log')) fs.truncateSync('telnet.log');

        const encerrar = () => {
            if (finalizado) return;
            finalizado = true;
            client.destroy();
            
            if (acao === 'listar') resolve(formatarListaGeral(sw.nome, buffer));
            else if (acao === 'full') resolve(formatarConfigFull(sw.nome, portaReal, buffer));
            else if (acao === 'shutdown' || acao === 'unshutdown') resolve(formatarConfirmacao(sw.nome, portaReal, buffer, acao));
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
            else if ((cleanOut.includes('<') || cleanOut.includes('[')) && loginEtapa === 2 && !comandosEnviados) {
                comandosEnviados = true;
                
                setTimeout(() => {
                    client.write('screen-length 0 temporary\r\n');
                    
                    setTimeout(() => {
                        if (acao === 'listar') {
                            client.write('display interface description\r\n');
                        } else {
                            client.write('sys\r\n');
                            setTimeout(() => {
                                if (acao === 'full') {
                                    client.write(`dis cu int ${portaReal}\r\n`);
                                } else if (acao === 'shutdown' || acao === 'unshutdown') {
                                    const cmd = acao === 'shutdown' ? 'shutdown' : 'undo shutdown';
                                    client.write(`interface ${portaReal}\r\n${cmd}\r\n`);
                                    setTimeout(() => client.write('display this\r\n'), 800);
                                } else {
                                    client.write(`dis int ${portaReal} | inc Description\r\n`);
                                    client.write(`dis trans diag int ${portaReal}\r\n`);
                                }
                            }, 1000);
                        }
                        
                        setTimeout(() => {
                            client.write('ret\r\n');
                            client.write('q\r\n');
                            setTimeout(encerrar, 2500);
                        }, 5500);
                    }, 1000);
                }, 1500);
            }
        });

        client.on('error', () => { if (buffer.length > 500) encerrar(); });
    });
}

function formatarConfirmacao(nomeSw, porta, log, acao) {
    const status = (acao === 'unshutdown') ? '✅ *REATIVADA (UP)*' : '🚫 *DESLIGADA (DOWN)*';
    
    // Captura o bloco entre os '#' que o 'display this' gera
    const regexThis = /#([\s\S]*?)#/g;
    const matches = log.match(regexThis);
    let configAtual = matches ? matches[matches.length - 1].trim() : "Configuração não capturada.";

    return `⚡ *MANOBRA DE INTERFACE*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n*Status:* ${status}\n\n*Recibo do Terminal (dis this):*\n\`\`\`\n#\n${configAtual}\n#\n\`\`\`\n────────────────\n_Ação confirmada via hardware._`;
}

function formatarListaGeral(nomeSw, log) {
    const linhas = log.split(/\r?\n/);
    let trunks = [], vlans = [], xg = [], ge100 = [], outros = [];

    linhas.forEach(linha => {
        const l = linha.trim();
        const match = l.match(/^([a-zA-Z0-9\/\.\-]+)\s+(up|down|\*down)\s+(up|down|up\(s\))\s*(.*)/i);
        if (match) {
            const [_, interfaceNome, phy, proto, desc] = match;
            const nameL = interfaceNome.toLowerCase();
            if (nameL.startsWith('loop') || nameL.startsWith('meth') || nameL.startsWith('null') || nameL.startsWith('tun')) return; 
            let emoji = (phy.toLowerCase() === 'up') ? '✅' : '❌';
            if (phy.toLowerCase().includes('*down')) emoji = '🚫';
            const txt = `${emoji} \`${interfaceNome.padEnd(20)}\` | \`${phy}/${proto}\` | ${desc.trim() || '---'}`;
            if (nameL.includes('eth-trunk')) trunks.push(txt);
            else if (nameL.includes('vlanif')) vlans.push(txt);
            else if (nameL.includes('100ge')) ge100.push(txt);
            else if (nameL.includes('xge') || nameL.includes('xgigabit')) xg.push(txt);
            else if (!nameL.includes('interface')) outros.push(txt);
        }
    });

    let msg = `📂 *RESUMO DE INTERFACES - ${nomeSw}*\n\n`;
    if (trunks.length > 0) msg += `🔗 *ETH-TRUNKS*\n${trunks.join('\n')}\n\n`;
    if (ge100.length > 0) msg += `🚀 *INTERFACES 100GE*\n${ge100.join('\n')}\n\n`;
    if (xg.length > 0) msg += `⚡ *INTERFACES XG (10G)*\n${xg.join('\n')}\n\n`;
    if (vlans.length > 0) msg += `🌐 *VLAN INTERFACES*\n${vlans.join('\n')}\n\n`;
    if (outros.length > 0) msg += `🔌 *OUTRAS (GE/25GE)*\n${outros.join('\n')}`;
    return msg;
}

function gerarRelatorio(nomeSw, porta, log) {
    const linhas = log.split(/\r?\n/);
    let lanes = [];
    let limiteCritico = -13.00;
    let descricao = "---";
    const linhaDesc = linhas.find(l => l.toLowerCase().includes('description:'));
    if (linhaDesc) descricao = linhaDesc.split(':')[1]?.trim() || "---";
    const regexBloco = /RxPower\(dBm\)([\s\S]*?)(?=TxPower|Bias|Temp|Voltage|Current|$)/i;
    const blocoSinal = log.match(regexBloco);
    if (blocoSinal && blocoSinal[0]) {
        const matches = blocoSinal[0].match(/([-+]\d+\.\d+)/g);
        if (matches && matches.length >= 2) {
            limiteCritico = parseFloat(matches[1]);
            matches.forEach(m => {
                const val = parseFloat(m);
                if (val < 5 && val > -40 && val !== limiteCritico) lanes.push(val);
            });
        }
    } else {
        linhas.forEach(l => {
            if (l.toLowerCase().includes('rxpower')) {
                const m = l.match(/([-+]\d+\.\d+)/g);
                if (m) {
                    lanes.push(parseFloat(m[0]));
                    if (m[1]) limiteCritico = parseFloat(m[1]);
                }
            }
        });
    }
    const lanesUnicas = [...new Set(lanes)].sort((a, b) => a - b);
    if (lanesUnicas.length === 0) return `❌ *Sinal não localizado* em ${nomeSw}\n*Porta:* ${porta}\n*Desc:* ${descricao}`;
    const piorRX = lanesUnicas[0];
    const statusSinal = piorRX <= limiteCritico ? "🚨 SINAL CRÍTICO" : "✅ SINAL NORMAL";
    let msg = `📡 *DIAGNÓSTICO DE SINAL (RX)*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n*Desc:* ${descricao}\n────────────────\n`;
    lanesUnicas.forEach((v, i) => { msg += `📶 Lane ${i}: ${v.toFixed(2)} dBm\n`; });
    msg += `────────────────\n📉 Pior RX: ${piorRX.toFixed(2)} dBm\n📉 Lim. Crítico (Low): ${limiteCritico.toFixed(2)} dBm\n────────────────\n*${statusSinal}*`;
    return msg;
}

function formatarConfigFull(nomeSw, porta, log) {
    const portaBusca = porta.replace(/\s+/g, '');
    const regex = new RegExp(`interface\\s*${portaBusca}[\\s\\S]*?#`, 'i');
    const match = log.match(regex);
    return `📄 *CONFIGURAÇÃO ATUAL*\n\n*SW:* ${nomeSw}\n*Porta:* ${porta}\n────────────────\n\`\`\`\n${match ? match[0].trim() : 'Não localizado'}\n\`\`\`\n────────────────`;
}
