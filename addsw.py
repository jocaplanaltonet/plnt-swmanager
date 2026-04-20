import sys
import os
import re

def mostrar_ajuda():
    print("""
📖 AJUDA: GESTÃO DE SWITCHES (addsw.py)

Uso: python3 addsw.py $NOME $IP $USER $PASS [$MODELO] [$PROTOCOLO]
     python3 addsw.py -l  (Para listar existentes)

ARGUMENTOS:
  $NOME, $IP, $USER, $PASS : Dados obrigatórios para novo switch.
  $MODELO    : Modelo cadastrado (Padrão: S6730-H24X6C-100G).
  $PROTOCOLO : 't' ou 'telnet' (padrão), 's' ou 'ssh'.
  -l, --list : Lista todos os switches cadastrados no switches.js.
""")

def listar_switches():
    if not os.path.exists('switches.js'):
        print("❌ Ficheiro switches.js não encontrado.")
        return
    with open('switches.js', 'r', encoding='utf-8') as f:
        conteudo = f.read()
        # Regex para capturar nome, ip e modelo dos objetos JS
        matches = re.findall(r'nome:\s*"([^"]+)",\s*ip:\s*"([^"]+)",\s*modelo:\s*"([^"]+)"', conteudo)
        if not matches:
            print("📭 Nenhum switch encontrado ou formato inválido.")
            return
        
        print(f"\n🖥️  SWITCHES CADASTRADOS ({len(matches)}):")
        print("-" * 60)
        for i, (nome, ip, modelo) in enumerate(matches, 1):
            print(f"{i:02d}. {nome.ljust(15)} | IP: {ip.ljust(15)} | Modelo: {modelo}")
        print("-" * 60 + "\n")

def carregar_modelos():
    if not os.path.exists('models.js'): return []
    with open('models.js', 'r', encoding='utf-8') as f:
        conteudo = f.read()
        return re.findall(r'"([^"]+)":\s*{', conteudo)

def adicionar_switch():
    if len(sys.argv) < 2 or sys.argv[1] in ['-h', '--help']:
        mostrar_ajuda()
        sys.exit(0)
    
    if sys.argv[1] in ['-l', '--list']:
        listar_switches()
        sys.exit(0)

    if len(sys.argv) < 5:
        print("❌ Erro: Argumentos insuficientes. Use -h para ajuda.")
        sys.exit(1)

    nome, ip, user, password = sys.argv[1:5]
    modelo = sys.argv[5] if len(sys.argv) > 5 else "S6730-H24X6C-100G"
    prot_input = sys.argv[6].lower() if len(sys.argv) > 6 else "t"
    protocolo = "s" if prot_input in ["ssh", "s"] else "t"
    
    if modelo not in carregar_modelos():
        print(f"⚠️  Modelo '{modelo}' não existe! Cadastre-o com addmodel.py primeiro.")
        sys.exit(1)

    with open('switches.js', 'r', encoding='utf-8') as f:
        linhas = f.readlines()

    novo_sw = f'    {{ nome: "{nome}", ip: "{ip}", modelo: "{modelo}", usuario: "{user}", senha: "{password}", protocolo: "{protocolo}" }}'
    nova_lista = []
    for i, linha in enumerate(linhas):
        if '];' in linha:
            if i > 0 and '}' in nova_lista[-1] and ',' not in nova_lista[-1]:
                nova_lista[-1] = nova_lista[-1].replace(' }', ' },').replace('}\n', '},\n')
            nova_lista.append(novo_sw + "\n")
            nova_lista.append(linha)
        else:
            nova_lista.append(linha)

    with open('switches.js', 'w', encoding='utf-8') as f:
        f.writelines(nova_lista)
    print(f"✅ Switch {nome} adicionado!")

if __name__ == "__main__":
    adicionar_switch()
