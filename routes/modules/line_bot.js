const { text, line, router } = require('bottender/router');
const { chain } = require('bottender');
const robot = {
  firstMeet: async (context) => {
    // Maybe add code to send a msg to the admin
    context.replyText('歡迎使用鴨稅錢');
    context.replyText('請先向管理員要求註冊，才可使用鴨稅錢功能');
    context.replyText('註冊完畢後，請輸入任意訊息');
  },
  authenticate: async (context, props) => {
    if (context.state.authenticated) {
      return props.next;
    }
    // If the user is unauthorized in session, check the authentication in the database
    // send unauthorized message
    await context.replyText('尚未註冊完成，請向管理員確認');
  },
  mainMenu: async (context) => {
    if (context.event.isText) {
      await context.replyText('歡迎使用鴨稅錢，請點選以下功能:');
      await context.replyTemplate('主要功能', {
        type: 'buttons',
        thumbnailImageUrl:
          'https://www.shutterstock.com/image-vector/cute-cartoon-rubber-duck-vector-600nw-2276837591.jpg',
        title: '功能清單',
        text: '請選擇以下功能',
        actions: [
          {
            type: 'message',
            label: '查詢',
            text: '查詢',
          },
        ],
      });
    }
  },
  searching: async (context) => {
    await context.replyTemplate('查詢功能', {
      type: 'buttons',
      title: '主要功能',
      text: '請選擇以下功能',
      actions: [
        {
          type: 'message',
          label: '個人綜所稅',
          text: '個人綜所稅',
        },
        {
          type: 'message',
          label: '營所稅',
          text: '營所稅',
        },
        {
          type: 'message',
          label: '營業稅',
          text: '營業稅',
        },
        {
          type: 'message',
          label: '工商登記',
          text: '工商登記',
        },
      ],
    });
  },
  inDeveloping: async (context) => {
    await context.replyText('功能開發中，請稍待');
  },
  lineMessageHandler: async () => {
    return chain([
      robot.switchAuthentication,
      robot.authenticate,
      robot.lineMessageRouter,
    ]);
  },
  lineMessageRouter: async () => {
    return router([
      text('主頁', robot.mainMenu),
      text('查詢', robot.searching),
      text(['個人綜所稅', '營所稅', '營業稅', '工商登記'], robot.inDeveloping),
      text('postback', robot.testPostBack),
    ]);
  },
  testPostBack: async (context) => {
    if (context.event.isPayload) {
      console.log(context.event);
      await context.replyText(`${context.event.payload}`);
    }
    await context.replyTemplate('postBack 測試', {
      type: 'buttons',
      title: 'postBack 測試',
      text: '請選擇以下PostBack',
      actions: [
        {
          type: 'postback',
          label: '標題',
          data: 'a=1,b=2',
          displayText: '使用者點擊會傳送這個，實際傳送data',
        },
      ],
    });
  },
  linePostBackHandler: async () => {
    return chain([robot.authenticate, robot.testPostBack]);
  },
};

module.exports = router([
  line.follow(robot.firstMeet),
  line.message(robot.lineMessageHandler), // Handling line msg
  line.postback(robot.linePostBackHandler),
  text('*', robot.lineMessageHandler),
]);
