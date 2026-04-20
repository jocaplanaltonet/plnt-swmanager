import requests
import json

SESSION = "plnt"
URL = f"http://127.0.0.1:21465/api/{SESSION}/list-chats"
TOKEN = "$2b$10$sMn3zJy1NFPgQMmOSIoSGealQBi8MOxaEy_xojujhmoeXdOyl5qlm"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Payload conforme o Swagger para filtrar grupos
payload = {
    "onlyGroups": True
}

try:
    r = requests.post(URL, json=payload, headers=headers)
    
    if r.status_code in [200, 201]:
        # A API retorna uma LISTA direta: [ {...}, {...} ]
        dados = r.json()
        
        if isinstance(dados, list):
            print(f"{'NOME DO GRUPO':<35} | {'ID (JID)':<35}")
            print("-" * 75)
            for chat in dados:
                nome = chat.get('name') or "Sem Nome"
                # O ID pode vir como string ou objeto. Tratamos ambos:
                jid = chat.get('id')
                if isinstance(jid, dict):
                    jid = jid.get('_serialized')
                
                print(f"{str(nome)[:34]:<35} | {str(jid):<35}")
        else:
            print("⚠️ A resposta não veio no formato de lista esperado.")
            print("Resposta bruta:", dados)
    else:
        print(f"❌ Erro na API ({r.status_code}): {r.text}")

except Exception as e:
    print(f"❌ Falha no processamento: {e}")
