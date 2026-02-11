# Guia de Instalação e Execução

## Instalação de Dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

Este comando irá:
- Remover o pacote `firebase` antigo
- Instalar o novo pacote `@supabase/supabase-js`
- Atualizar todas as dependências

## Executar o Projeto

### Modo Desenvolvimento
```bash
npm run dev
```

O projeto estará disponível em: `http://localhost:5173`

### Build de Produção
```bash
npm run build
```

## Credenciais

As credenciais do Supabase estão no arquivo `.env`:
- **URL**: https://wiuryqhvwhbfhkuljipj.supabase.co
- **Anon Key**: Configurada automaticamente

## Login no Sistema

- **Senha Admin padrão**: `123456`
- **Acesso Visualizador**: Sem senha

## Próximos Passos

1. Execute `npm install` para instalar as dependências
2. Execute `npm run dev` para testar o projeto
3. Faça login e teste as funcionalidades (adicionar policiais, criar escalas, etc.)
