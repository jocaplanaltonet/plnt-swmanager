import os

def adicionar_switch():
    caminho_arquivo = '/opt/gestao-redes-bot/switches.js'
    
    print("--- Cadastro de Novo Switch ---")
    nome = input("Nome (ex: BKB_CHAN): ").upper()
    ip = input("IP: ")
    modelo = input("Modelo: ")
    usuario = input("Usuário: ")
    senha = input("Senha: ")
    
    # Monta a nova linha no formato de objeto JS
    nova_linha = f'    {{ nome: "{nome}", ip: "{ip}", modelo: "{modelo}", usuario: "{usuario}", senha: "{senha}", protocolo: "t" }}'

    if not os.path.exists(caminho_arquivo):
        print("Erro: Arquivo switches.js não encontrado!")
        return

    with open(caminho_arquivo, 'r', encoding='utf-8') as f:
        linhas = f.readlines()

    # Filtra as linhas para encontrar onde termina o array
    conteudo_limpo = []
    for linha in linhas:
        if "];" not in linha and "export default" not in linha:
            conteudo_limpo.append(linha.rstrip())

    # Remove vírgula da última linha se existir para reformatar
    if conteudo_limpo[-1].endswith(','):
        conteudo_limpo[-1] = conteudo_limpo[-1][:-1]

    # Reconstrói o arquivo
    novo_conteudo = []
    for i, linha in enumerate(conteudo_limpo):
        # Se for um item do array (exceto a primeira linha de declaração), adiciona vírgula
        if "{" in linha and i < len(conteudo_limpo) - 1:
            novo_conteudo.append(linha + ",")
        else:
            novo_conteudo.append(linha)

    # Adiciona a vírgula no que era o último e insere o novo
    if "{" in novo_conteudo[-1]:
        novo_conteudo[-1] = novo_conteudo[-1] + ","
    
    novo_conteudo.append(nova_linha)
    novo_conteudo.append("];")
    novo_conteudo.append("")
    novo_conteudo.append("export default listaSwitches;")

    with open(caminho_arquivo, 'w', encoding='utf-8') as f:
        f.write("\n".join(novo_conteudo))

    print(f"\n✅ Switch {nome} adicionado com sucesso e vírgulas corrigidas!")

if __name__ == "__main__":
    adicionar_switch()
