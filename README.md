# 🤖 Switch Automation Bot (Huawei Backbone)

Bot de automação via WhatsApp para gestão de ativos de rede Huawei (**NE8000** e **Switches**). Focado em agilidade operacional e diagnóstico de backbone em tempo real.

## 🚀 Funcionalidades Principais

*   **Diagnóstico de Sinal (RX):** Leitura de potência óptica com suporte a interfaces **100GE (4 lanes)** e detecção dinâmica de limite crítico baseado no hardware.
*   **Listagem Agrupada:** Visualização de interfaces divididas por tecnologia (`Eth-Trunk`, `100GE`, `10G`, `VLANs`).
*   **Filtro de Ruído:** Remoção automática de interfaces virtuais (`Loopback`, `Tunnel`, `NULL`, `MEth`) para clareza operacional.
*   **Manobras com Recibo:** Comandos de `shutdown` e `undo shutdown` com confirmação automática via `display this` (Recibo do Terminal).

## 🛠️ Guia de Comandos

A sintaxe padrão é: `[ID do Switch] [Comando/Porta]`.

| Comando | Descrição | Exemplo |
| :--- | :--- | :--- |
| **`l`** | Lista interfaces físicas agrupadas e limpas. | `2 l` |
| **`[Porta]`** | Mostra o sinal RX (detalhado para 100G). | `3 c1` |
| **`[Porta]?`** | Status rápido (PHY/Protocolo/Descrição). | `1 x5?` |
| **`[Porta]u`** | **Unshutdown**: Liga a interface + Recibo visual. | `2 c1u` |
| **`[Porta]s`** | **Shutdown**: Desliga a interface + Recibo visual. | `2 c1s` |
| **`[Porta]f`** | **Full Config**: Traz o `display current-config` da porta. | `1 g2f` |

## 📦 Estrutura do Módulo

*   `telnet.js`: Núcleo de comunicação Telnet e parsing de comandos Huawei VRP.
*   `switches.js`: Cadastro de IPs, nomes e credenciais dos ativos.
*   `jocawpp.py`: Integração com a API do WhatsApp para notificações.

## 🔧 Execução em Produção

Utilize o PM2 para garantir que o bot permaneça online:
```bash
pm2 start index.js --name rede-wpp-bot
pm2 save
