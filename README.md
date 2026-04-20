<<<<<<< HEAD
# swmanager
Gestao de Switch Huawei
=======
# 🌐 Gestor de Switches Huawei - WhatsApp Bot

Sistema de automação para monitoramento e gestão de switches Huawei via WhatsApp, focado em consultas de sinal óptico (RX) e status de interfaces.

## 🚀 Funcionalidades
- 📊 **Consulta de Sinal RX**: Suporte a interfaces 1G, 10G, 40G e 100G (Multi-lane).
- ⚡ **Status da Porta**: Verificação rápida de PHY e Protocol (Up/Down).
- 🚫 **Gestão de Interface**: Comandos de Shutdown e Unshutdown remotos.
- 🕒 **Fila de Processamento**: Evita sobrecarga de sessões Telnet no switch.

## 🛠️ Comandos Disponíveis
Envie no WhatsApp no formato: `ID_SWITCH COMANDO`

| Comando | Descrição | Exemplo |
| :--- | :--- | :--- |
| **ID + Porta** | Consulta Diagnóstico de Sinal | `1 c1` |
| **ID + Porta?** | Consulta Status (Up/Down) | `1 c1?` |
| **ID + Portas** | Desligar Porta (Shutdown) | `1 c1s` |
| **ID + Portau** | Religar Porta (Unshutdown) | `1 c1u` |

## ⚙️ Tecnologias
- Node.js
- Axios (Integração WPPConnect)
- Telnet (Protocolo de comunicação de rede)

---
*Desenvolvido por João Ferreira*
>>>>>>> 1bacb26 (v1.0.3 - Versão Estável com suporte a 100G e Telnet revisado)
