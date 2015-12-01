# join
Gaming should be fun, do it together with your friends or make new ones.


## Running on browser

* Execute "ionic serve" or "phonegap serve" for browser execution
* Execute "phonegap serve" to use with phonegap app development ( p.s some plugins won't work properly )

## Running on android
* Execute "phonegap platform add <platform>" to configure the platform (e.g phonegap platform add android)
* Execute "phonegap build <platform>" to build the project (e.g phonegap build android).
* Execute "phonegap run <platform>" to run the project on virtual device (i.e if you have android vm configured the vm should popup).
* Execute "phonegap run <platform>" --targer="<device_id>" to run the project on device via usb (use adb devices to list all plugged devices).


## Building Remotely
* Execute "phonegap remote build <platform>" to build the app on build.phonegap.com

## Ideas / TODO (move to issues)

* i) Enviar notificacao 1 hora, meia-hora, antes da atividade começar e solicitar confirmaçao dos participantes.
* j) Reenviar o convite de atividade para grupo, caso time nao esteja completo.
* q) Chat individual
* s) Criar 9 patch para splash screen


## App explanation

*

## Cenário de testes

1) Tela principal "Grupos ativos" sem estar em nenhum grupo deve apresentar sugestões de grupos publicos.
1.1) Fazer swipe no grupo público e clicar em 'Join', deve entrar no grupo, e ser levado a tela de grupos.
2) Clicar no grupo publico deve levar a tela de chat.
2.1) Digitar no input do chat e clicar em enviar, a mensagem deve aparecer na tela.
2.2) Ainda na tela de chat, abrir menu lateral e ir em 'Dados do grupo', deve apresentar a tela com as informações do grupo.
2.2.1) Clicar no botão silenciar, deve apresentar a mensagem informando que o grupo foi silenciado.
2.3) No menu lateral ir para 'participantes'.
2.3.1) Apresenta a lista com os participantes do grupo, clicando em cima do proprio nome não deve acontecer nada.
2.3.2) Clicar no icone superior a direita, para convidar um amigo ao grupo, as listas devem estar vazias caso não tenha amigos.
2.4) Clicar em 'Grupos Ativos'.
2.5) Clicar em 'Plataformas', deve apresentar um tela com as plataformas disponiveis para o grupo.
2.5.1) Clicar em um ou mais plataformas para desabilitar as notificações para ela.
2.5.2) Saia e entre novamente para verificar que o estado das plataformas continua o mesmo após qualquer mudança.
3) Na tela de 'Grupos' de um swipe no grupo publico e clique em 'Sair', o grupo deve sumir da lista, de um refresh para ter certeza.
4) Na tela de 'Grupos' clique no icone 'lupa' na parte superior a direita.
4.1) Na tela buscar devera apresentar os grupos publicos e apresentar um campo para filtro, verificar se o filtro está ok.
4.2) Fazer um swipe no grupo e clicar em 'Join', você deverá ser levado a tela de 'Grupos' e o grupo está disponivel na lista, depois disso, saia do grupo novamente.
5) Vá para a tela 'Contatos', caso você não tenha amigos ou seguidores ambas as listas estaram vazias.
5.1) Clique no icone 'lupa' no canto superior a direita, deve apresentar uma tela em branco com um campo na parte superior.
5.2) Digite no campo para localizar os usuários.
5.3) Ao localizar um usuário clique em cima e deve apresentar um menu com as opções 'Seguir' e 'Deixar de Seguir'.
5.4) Clique em seguir, deve apresentar a mensagem 'Feito', clique no 'x' para voltar e o usuario deve estar na lista de 'Amigos'.
5.5) Clique no usuario da lista para apresetar o menu, clique em 'Deixar de Seguir' a lista devera ficar vazia novamente.
5.6) Adicione um amigo novamente para continuar os teste.
6.0) Na tela de 'Grupos' clique na lupa e depois no icone '+', deve ser apresentada uma list com os jogos disponíveis para criação do grupo.
6.1) A lista pode ser pesquisada, escolha uma e clique em cima, será apresentada a tela para escolha da plataforma, nome e amigos.
6.2) Selecione as ao menos uma plataforma, e informe um nome, selecione um amigo e clique em criar.
6.3) O grupo deve aparecer na lista de grupos em 'Grupos privados', eles também serão incluidos na lista dos amigos convidados.
6.4) Assim como no grupo publico deve ser possível utilizar o chat, ver os dados do grupo, os participantes, grupos ativos.
7) Em 'Grupos Ativos' ou 'Grupos' existe um icone de 'controle' onde é possivel iniciar a criação de uma nova atividade, clique em qualquer um deles.
7.1) Na proxima tela irá apresentar os grupos privados e públicos ao qual você pertence, escolha um deles e clique em 'Convidar este grupo'.
7.2) Você será levado para a tela de criação de atividade, selecione todos os campos e clique em convidar para criar a atividade.
7.3) Você será levado para a tela de 'Grupos ativos' e sua nova atividade deverá estar lá, também um convite será enviado para todos que pertencem ao grupo escolhido
     no momento da criação considerando as plataformas que o usuário escolheu para ser notificado.
8 ) Entrando como o usuario que recebeu a notificação ela sera exibida em 'Convites pendentes' na aba 'Grupos ativos', de um swipe que as opções 'Join' ou 'Recusar' irão aparecer.
8.1) Clique em Join a tela dara um refresh e o grupo irá aparecer como um grupo ativo.
8.2) Com os dois usuários entre no grupo da atividade, e vá para participantes.
8.3) Clique em um dos usuarios e depois em solicitar confirmação, uma mensagem de confirmação deverá ser enviada para o usuário.