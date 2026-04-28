import requests
import json

SESSION = "plnt"
URL = f"http://127.0.0.1:21465/api/{SESSION}/list-chats"
TOKEN = "$2b$10$sMn3zJy1NFPgQMmOSIoSGealQBi8MOxaEy_xojujhmoeXdOyl5qlm"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

payload = {
    "onlyGroups": True
}

try:
    r = requests.post(URL, json=payload, headers=headers)
    
    if r.status_code in [200, 201]:
        dados = r.json()
        
        if isinstance(dados, list):
            print(f"{'NOME DO GRUPO':<35} | {'ID (JID)':<35}")
            print("-" * 75)
            for chat in dados:
                # --- AJUSTE AQUI ---
                # Tenta pegar o nome de várias fontes possíveis na API
                nome = chat.get('name') or chat.get('formattedTitle')
                
                # Se ainda for None, tenta buscar dentro do objeto de contato
                if not nome and chat.get('contact'):
                    nome = chat.get('contact').get('name') or chat.get('contact').get('pushname')
                
                if not nome:
                    nome = "Sem Nome"
                # -------------------

                jid = chat.get('id')
                if isinstance(jid, dict):
                    jid = jid.get('_serialized')
                
                print(f"{str(nome)[:34]:<35} | {str(jid):<35}")
        else:
            print("⚠️ A resposta não veio no formato de lista esperado.")
    else:
        print(f"❌ Erro na API ({r.status_code}): {r.text}")

except Exception as e:
    print(f"❌ Falha no processamento: {e}")
