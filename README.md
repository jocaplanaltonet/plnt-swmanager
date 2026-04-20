# 🌐 Gestor de Switches Huawei - WhatsApp Bot (v1.0.4)

Sistema de automação para monitoramento e gestão de infraestrutura de rede Planalto Net via WhatsApp.

## 🛠️ Comandos do WhatsApp
Envie no formato: `ID_SWITCH COMANDO`

| Comando | Descrição | Exemplo |
| :--- | :--- | :--- |
| **ID + Porta** | Consulta Diagnóstico de Sinal (RX) | `1 c1` |
| **ID + Porta?** | Consulta Status (Up/Down) | `1 c1?` |
| **ID + Portas** | Desligar Porta (Shutdown) | `1 c1s` |
| **ID + Portau** | Religar Porta (Unshutdown) | `1 c1u` |

> **Legenda de Portas:** g=1G, x=10G, e=25G, q=40G, c=100G.

## 🖥️ Gestão via Terminal (Scripts Python)
Scripts auxiliares para manutenção da base de dados local.

### 1. Gestão de Switches (`addsw.py`)
- **Adicionar:** `python3 addsw.py $NOME $IP $USER $PASS [$MODELO] [$PROTOCOLO]`
- **Listar Cadastrados:** `python3 addsw.py -l`
- **Ajuda:** `python3 addsw.py --help`

### 2. Gestão de Modelos (`addmodel.py`)
- **Adicionar:** `python3 addmodel.py $MODELO $PORTAS`
- **Listar Cadastrados:** `python3 addmodel.py -l`
- **Ajuda:** `python3 addmodel.py --help`

---
