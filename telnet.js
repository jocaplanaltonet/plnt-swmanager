import net from 'net';
import fs from 'fs';
import listaSwitches from './switches.js';

function gravarLogPuro(texto) {
    fs.appendFileSync('telnet.log', texto);
}

function executarTelnet(sw, comandos, tempoEspera = 4000) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        let buffer = '';
        let finalizado = false;
        let loginEtapa = 0;
        let comandoEnviado = false;

        const encerrar = () => {
            if (finalizado) return;
            finalizado = true;
            client.destroy();
            resolve(buffer);
        };

        client.connect(23, sw.ip);

        client.on('data', (data) => {
            const out = data.toString('binary');
            const cleanOut = out.replace(/[^\x20-\x7E\n\r\t]/g, '');
            buffer += cleanOut;

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
                        comandos.forEach(cmd => client.write(`${cmd}\r\n`));
                        setTimeout(() => {
                            client.write('quit\r\n');
                            setTimeout(encerrar, 1000);
                        }, tempoEspera);
                    }, 1000);
                }, 1000);
            }
        });

        client.on('error', () => encerrar());
        setTimeout(encerrar, 25000);
    });
}

export async function consultarPorta(msg, callbackProgresso) {
    const partes = msg.trim().toLowerCase().split(/\s+/);
    const idIndex = partes[0]; 
    let portaInput = partes.slice(1).join('').replace(/\s+/g, ''); 

    if (idIndex === 'menu' && portaInput === 'update') {
        if (callbackProgresso) await callbackProgresso("⏳ *Atualizando Informações do Backbone...* Iniciando checagem.");
        return atualizarVersoesEModelos(callbackProgresso);
    }

    const indexNum = parseInt(idIndex);
    const sw = listaSwitches[indexNum];
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

    if (fs.existsSync('telnet.log')) fs.truncateSync('telnet.log');

    let comandos = [];
    if (acao === 'listar') {
        comandos.push('display interface description');
    } else {
        comandos.push(`display interface ${portaReal} | include Description`);
        if (prefixo === 'c' || prefixo === 'q') {
            comandos.push(`display transceiver interface ${portaReal}`);
        }
        comandos.push(`display transceiver diagnosis interface ${portaReal} | begin Rx`);
    }

    const tempoEspera = acao === 'listar' ? 6000 : (prefixo === 'c' || prefixo === 'q' ? 5000 : 4000);
    const logObtido = await executarTelnet(sw, comandos, tempoEspera);
    gravarLogPuro(logObtido);

    if (acao === 'listar') return formatarListaGeral(sw.nome, logObtido);
    if (acao === 'status') return formatarStatus(sw.nome, portaReal, logObtido);
    return gerarRelatorio(sw.nome, portaReal, logObtido);
}

async function atualizarVersoesEModelos(callbackProgresso) {
    let resultados = [];
    const totalSwitches = listaSwitches.length;

    for (let i = 0; i < totalSwitches; i++) {
        const sw = listaSwitches[i];
        
        const vAntiga = sw.versao || "N/A";
        const mAntigo = sw.modelo || "Huawei";

        const porcentagem = Math.round(((i + 1) / totalSwitches) * 100);
        
        if (callbackProgresso) {
            await callbackProgresso("🔄 *Progresso:* " + porcentagem + "% concluído.\nConectando em: *" + sw.nome + "*...");
        }

        try {
            const log = await executarTelnet(sw, ['display version'], 3000);
            const linhas = log.split(/\r?\n/);
            
            let vNova = "Desconhecida";
            let mNovo = "Huawei";

            for (let l of linhas) {
                l = l.trim();
                
                if (l.toLowerCase().includes('version') || l.toLowerCase().includes('software')) {
                    const matchR = l.match(/(R\d{3})/i);
                    if (matchR) {
                        vNova = matchR[1].toUpperCase();
                    }
                }
                
                if (l.toLowerCase().includes('uptime is')) {
                    const matchModelo = l.match(/HUAWEI\s+([A-Za-z0-9\-]+)\s+/i);
                    if (matchModelo) mNovo = matchModelo[1];
                }
            }

            if (mNovo.includes("S6730") && !mNovo.includes("-100G")) {
                mNovo = mNovo + "-100G";
            }

            let alteracaoTexto = "_(Sem alterações)_";
            if (vAntiga !== vNova || mAntigo !== mNovo) {
                alteracaoTexto = "⚠️ *ALTERADO:* Antigo: " + mAntigo + " (" + vAntiga + ") ➡️ Novo: " + mNovo + " (" + vNova + ")";
            }

            listaSwitches[i].versao = vNova;
            listaSwitches[i].modelo = mNovo;
            
            resultados.push("✅ *" + sw.nome + ":* " + mNovo + " (" + vNova + ")\n   " + alteracaoTexto);

        } catch (err) {
            resultados.push("❌ *" + sw.nome + ":* Falha na conexão/timeout");
        }
    }

    const conteudoArquivo = "const listaSwitches = " + JSON.stringify(listaSwitches, null, 4) + ";\n\nexport default listaSwitches;";
    fs.writeFileSync('./switches.js', conteudoArquivo, 'utf-8');

    return "📊 *RELATÓRIO FINAL DE ATUALIZAÇÃO*\n\n" + resultados.join('\n\n') + "\n\n_O menu interno foi atualizado com sucesso!_";
}

function formatarListaGeral(nomeSw, log) {
    const lines = log.split(/\r?\n/);
    let ethTrunks = [];
    let fisicas = [];

    lines.forEach(l => {
        const match = l.match(/^([a-zA-Z0-9\/\.\-]+)\s+(up|down|\*down)\s+(up|down)\s+(.*)$/i);
        
        if (match) {
            const nomeInt = match[1];
            const phy = match[2].toLowerCase();
            const proto = match[3].toLowerCase();
            const desc = match[4].trim() || '---';
            
            let emoji = '🚫'; 

            if (phy === 'up' && proto === 'up') {
                emoji = '✅';
            } else if (phy === 'up' && proto === 'down') {
                emoji = '🚨'; 
            }
            
            const linha = emoji + " `" + nomeInt.padEnd(18) + "` `" + " | " + "`" + phy + "/" + proto + " | " + desc;

            if (nomeInt.toLowerCase().includes('trunk')) {
                ethTrunks.push(linha);
            } else if (!nomeInt.toLowerCase().includes('null') && !nomeInt.toLowerCase().includes('meth')) {
                fisicas.push(linha);
            }
        }
    });

    let msg = "📂 *RESUMO DE INTERFACES - " + nomeSw + "*\n\n";
    if (ethTrunks.length > 0) msg += "🔗 *ETH-TRUNKS*\n" + ethTrunks.join('\n') + "\n\n";
    if (fisicas.length > 0) msg += "⚡ *INTERFACES FÍSICAS*\n" + fisicas.join('\n');

    return msg || "❌ Nenhuma interface capturada no log.";
}

function gerarRelatorio(nomeSw, porta, log) {
    const linhas = log.split(/\r?\n/);
    let lanes = [], limite = -16.40, desc = "---"; 
    let capturaAtivaR022 = false;
    let linhasRestantesR022 = 0;
    
    const dLine = linhas.find(l => l.toLowerCase().includes('description:'));
    if (dLine) desc = dLine.split(':')[1]?.trim() || "---";

    for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i].trim();
        const linhaLimpa = l.replace(/\s+/g, '').toLowerCase();
        
        // Se a escuta da R022 bater em um parâmetro novo (como Current, Temp, etc.), corta imediatamente
        if (capturaAtivaR022 && (linhaLimpa.includes('current') || linhaLimpa.includes('temp') || linhaLimpa.includes('volt'))) {
            capturaAtivaR022 = false;
            linhasRestantesR022 = 0;
        }

        // 1. GATILHO GENÉRICO DE RX POWER (Funciona na R022 e R024)
        if (linhaLimpa.includes('rxpower')) {
            const nums = l.match(/-?\d+\.\d+/g);
            if (nums && nums.length > 0) {
                lanes.push(parseFloat(nums[0]));
                
                // Extração do limite dinâmico de alarme baixo
                if (nums.length >= 4) {
                    limite = parseFloat(nums[3]); // Layout R024 (4ª coluna de números)
                } else if (nums.length >= 2) {
                    limite = parseFloat(nums[1]); // Layout R022 (2ª coluna de números)
                }
                
                // Se for o formato órfão da R022 (lane0 colada na linha), liga a esteira consecutiva
                if (linhaLimpa.includes('lane0') || l.includes('(lane0)')) {
                    capturaAtivaR022 = true;
                    linhasRestantesR022 = 3;
                }
            }
            continue;
        }

        // 2. FILTRO EXCLUSIVO PARA AS LANES ÓRFÃS DO VRP R022
        if (capturaAtivaR022 && linhasRestantesR022 > 0) {
            // Garante que a linha começa estritamente com número/sinal e tem marcação de lane da R022
            if (/^-?\d+\.\d+/g.test(l) || l.includes('lane')) {
                const nums = l.match(/-?\d+\.\d+/g);
                if (nums && nums.length > 0) {
                    lanes.push(parseFloat(nums[0]));
                }
            }
            linhasRestantesR022--;
            if (linhasRestantesR022 === 0) capturaAtivaR022 = false;
        }
    }

    // Limpa possíveis ruídos de portas desativadas
    lanes = lanes.filter(v => v !== 0.00);

    if (lanes.length === 0) return "❌ Sinal não localizado em " + nomeSw + "\n*Porta:* " + porta + "\n*Desc:* " + desc;
    
    lanes = [...new Set(lanes)];
    const pior = Math.min(...lanes);
    const status = pior <= limite ? "🚨 *SINAL CRÍTICO*" : "✅ *SINAL NORMAL*";
    
    let msg = "📡 *SINAL (RX) - " + nomeSw + "*\n*Porta:* " + porta + "\n*Desc:* " + desc + "\n────────────────\n";
    lanes.forEach((v, idx) => msg += "📶 Lane " + idx + ": " + v.toFixed(2) + " dBm\n");
    msg += "────────────────\n📉 Pior RX: " + pior.toFixed(2) + " dBm\n📉 Limite Low: " + limite.toFixed(2) + " dBm\n────────────────\n" + status;
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
    return emoji + " *STATUS INTERFACE*\n\n*SW:* " + nomeSw + "\n*Porta:* " + porta + "\n*Estado:* " + estado + "\n*Protocolo:* " + protocolo + "\n*Desc:* " + desc;
}
