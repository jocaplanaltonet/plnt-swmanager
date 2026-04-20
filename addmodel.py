import sys
import os
import re

def mostrar_ajuda():
    print("""
📖 AJUDA: GESTÃO DE MODELOS (addmodel.py)

Uso: python3 addmodel.py $MODELO $PORTAS
     python3 addmodel.py -l  (Para listar existentes)

PORTAS: g(1G), x(10G), e(25G), q(40G), c(100G)
EXEMPLO: python3 addmodel.py 'S6730' 24x 6c
""")

def listar_modelos():
    if not os.path.exists('models.js'):
        print("❌ Ficheiro models.js não encontrado.")
        return
    with open('models.js', 'r', encoding='utf-8') as f:
        conteudo = f.read()
        # Captura a chave do modelo e a descrição
        matches = re.findall(r'"([^"]+)":\s*{\s*descricao:\s*"([^"]+)"', conteudo)
        if not matches:
            print("📭 Nenhum modelo encontrado.")
            return
        
        print(f"\n📦 MODELOS DE HARDWARE ({len(matches)}):")
        print("-" * 60)
        for i, (modelo, desc) in enumerate(matches, 1):
            print(f"{i:02d}. {modelo.ljust(20)} | Portas: {desc}")
        print("-" * 60 + "\n")

def adicionar_modelo():
    if len(sys.argv) < 2 or sys.argv[1] in ['-h', '--help']:
        mostrar_ajuda()
        sys.exit(0)

    if sys.argv[1] in ['-l', '--list']:
        listar_modelos()
        sys.exit(0)

    if len(sys.argv) < 3:
        print("❌ Erro: Argumentos insuficientes.")
        sys.exit(1)

    modelo_nome = sys.argv[1]
    args_portas = sys.argv[2:]
    mapeamento = {'g':('1G','GigabitEthernet0/0/'),'x':('10G','XGigabitEthernet0/0/'),'e':('25G','25GigabitEthernet0/0/'),'q':('40G','40GE0/0/'),'c':('100G','100GE0/0/')}
    
    prefixos_lista, desc_partes = [], []
    for p in args_portas:
        qtd = ''.join(filter(str.isdigit, p))
        tipo_letra = ''.join(filter(str.isalpha, p)).lower()
        if tipo_letra in mapeamento:
            tipo_nome, prefixo_str = mapeamento[tipo_letra]
            prefixos_lista.append(f'{{ tipo: "{tipo_nome}", prefixo: "{prefixo_str}", limite: {qtd} }}')
            desc_partes.append(f"{qtd}x {tipo_nome}")

    descricao = ", ".join(desc_partes)
    prefixos_js = ", ".join(prefixos_lista)
    novo_modelo_str = f'    "{modelo_nome}": {{ descricao: "{descricao}", prefixos: [{prefixos_js}] }}'

    with open('models.js', 'r', encoding='utf-8') as f:
        linhas = f.readlines()

    for i in range(len(linhas)-1, -1, -1):
        if '};' in linhas[i]:
            if i > 0 and '}' in linhas[i-1] and ',' not in linhas[i-1]:
                linhas[i-1] = linhas[i-1].replace(' }', ' },').replace('}\n', '},\n')
            linhas.insert(i, novo_modelo_str + "\n")
            break

    with open('models.js', 'w', encoding='utf-8') as f:
        f.writelines(linhas)
    print(f"✅ Modelo {modelo_nome} cadastrado!")

if __name__ == "__main__":
    adicionar_modelo()
