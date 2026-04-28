📑 Project Changelog: Switch Automation Bot
[1.9.0] - 28/04/2026 (Atual)
Foco: Confiabilidade de Manobra e Feedback de Hardware

Refatoração de Manobras: Comandos de ligar (u) e desligar (s) agora realizam a limpeza automática de sufixos na string da porta, evitando erros de sintaxe no switch.

Confirmação via display this: Implementada a captura do comando de checagem local; o bot envia um "Recibo do Terminal" em bloco de código para provar que a alteração foi aplicada no hardware.

Sincronismo de Configuração: Ajuste nos timers de resposta para garantir que o system-view processe a manobra antes do encerramento da sessão Telnet.

[1.8.0] - 27/04/2026
Foco: Monitoramento de Backbone e UX

Agrupamento de Interfaces: O comando l (listar) agora separa as portas por categorias: ETH-TRUNKS, 100GE, XG (10G), VLANIF e OUTRAS.

Filtro de Ruído Virtual: Exclusão automática de interfaces Loopback, Tunnel, NULL e MEth da listagem geral.

Limite Crítico Dinâmico: O relatório de sinal agora extrai o Low Alarm Threshold real do transceiver para validar o status de 🚨 SINAL CRÍTICO.

Migração para Description: Substituição do comando brief pelo display interface description para capturar nomes de clientes sem cortes.

[1.7.0] - Abril/2026
Foco: Estabilidade Telnet e VRP R024

Apoio VRP R024: Implementada lógica de captura por bloco para lidar com a nova formatação de transceivers em backbones NE8000.

Comando screen-length 0: Automação do comando screen-length 0 temporary para desativar a paginação sem alterar a configuração global.

Segurança de Buffer: Implementada trava de login por etapas para impedir vazamento de credenciais.

[1.2.0] - Fevereiro/2026
Foco: Expansão de Diagnóstico

Suporte a 100G: Implementação do parsing para interfaces de múltiplas lanes (LR4/SR4).

Configuração Full: Adicionado o sufixo f para extrair o display current-configuration interface rapidamente.

[1.0.0] - Janeiro/2026
Foco: Comandos Base via WhatsApp

Core Commands: Implementação inicial dos comandos de leitura de sinal óptico (dis trans diag) e status de porta (?).

Seletor de ID: Estrutura para gerenciar múltiplos switches Huawei através de IDs numéricos.
