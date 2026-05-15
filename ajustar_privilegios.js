import net from 'net';
import listaSwitches from './switches.js';

// Execução: node ajustar_privilegio.js SUA_SENHA_JOCA
const senhaJoca = process.argv[2];

if (!senhaJoca) {
    console.error("❌ Erro: Informe a senha do usuário joca. Ex: node ajustar_privilegio.js SENHA123");
    process.exit(1);
}

async function ajustarPrivilegio(sw) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        let loginEtapa = 0;
        let comandoEnviado = false;

        console.log(`[${sw.nome}] Conectando em ${sw.ip}...`);

        client.connect(23, sw.ip);

        client.on('data', (data) => {
            const out = data.toString();

            // 1. Login com usuário joca
            if (out.toLowerCase().includes('username') && loginEtapa === 0) {
                client.write('joca\r\n');
                loginEtapa = 1;
            } 
            // 2. Senha fornecida via linha de comando
            else if (out.toLowerCase().includes('password') && loginEtapa === 1) {
                client.write(senhaJoca + '\r\n');
                loginEtapa = 2;
            } 
            // 3. Execução dos comandos de privilégio
            else if ((out.includes('<') || out.includes('[')) && loginEtapa === 2 && !comandoEnviado) {
                comandoEnviado = true;
                
                client.write('system-view\r\n');
                setTimeout(() => {
                    client.write('aaa\r\n');
                    setTimeout(() => {
                        // Altera o nível do jocabot
                        client.write('local-user jocabot privilege level 3\r\n');
                        
                        // Responde ao Warning: "Are you sure to change the user privilege level? [Y/N]"
                        setTimeout(() => {
                            client.write('y\r\n'); 
                            
                            setTimeout(() => {
                                // Salva a configuração para não perder no reboot
                                client.write('save safely\r\n');
                                
                                setTimeout(() => {
                                    client.write('y\r\n'); // Confirma o salvamento do arquivo
                                    console.log(`✅ [${sw.nome}] Privilégio Level 3 aplicado e salvo!`);
                                    client.destroy();
                                    resolve();
                                }, 3000);
                            }, 1500);
                        }, 1500); 
                    }, 1000);
                }, 1000);
            }
        });

        client.on('error', (err) => {
            console.error(`❌ [${sw.nome}] Erro de conexão: ${err.message}`);
            resolve();
        });

        // Timeout de segurança
        setTimeout(() => {
            if (!comandoEnviado) {
                console.error(`⚠️ [${sw.nome}] Timeout na operação.`);
                client.destroy();
                resolve();
            }
        }, 20000);
    });
}

async function iniciarAutomacao() {
    console.log("🚀 Iniciando atualização de privilégios em massa...\n");
    for (const sw of listaSwitches) {
        await ajustarPrivilegio(sw);
    }
    console.log("\n✨ Processo concluído em todos os switches.");
}

iniciarAutomacao();
