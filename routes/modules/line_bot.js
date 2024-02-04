const querystring = require('querystring');
const axios = require('axios');
const { runQuery } = require('../../database');
const { text, line, router } = require('bottender/router');
const { chain, LineNotify } = require('bottender');
const lineNotify = new LineNotify({
  clientId: '',
  clientSecret: '',
  redirectUri: '',
}); // Use line notify directly by access token, the above property is not used but necessary
const linebot = {
  firstMeet: async (context) => {
    await context.replyText('歡迎使用鴨稅錢');
    await context.replyText('請等待管理者完成註冊手續，才可使用鴨稅錢功能');
    // Get userId and name with Line API and send line notify to admin
    const lineId = context.event.source.userId;
    const url = `https://api.line.me/v2/bot/profile/${lineId}`;
    const headers = {
      Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
    };
    try {
      const response = await axios.get(url, { headers });
      // Send line notify
      const token = process.env.LINE_NOTIFY_TOKEN;
      let message = `新用戶加入\n姓名:\n${response.data.displayName}\nlineId:\n${lineId}`;
      await lineNotify.sendNotify(token, message);
    } catch (error) {
      console.error(error.message);
    }
  },
  authenticate: async (context, props) => {
    if (context.state.authenticated) {
      return props.next;
    }
    // User is unauthorized in session, check the authentication in the database
    const lineId = context.event.source.userId;
    const query = `SELECT * FROM users WHERE line_id = $lineId;`;
    const params = { $lineId: lineId };
    const authenticateUser = await runQuery(query, params);
    if (authenticateUser.length != 0) {
      context.setState({ authenticated: true });
      return props.next;
    }
    // send unauthorized message
    await context.replyText('尚未註冊完成，請向管理員確認');
  },
  switchAuthentication: async (context, props) => {
    if (context.event.text === process.env.AUTH_SECRET) {
      const authenticated = !context.state.authenticated;
      context.setState({ authenticated });
      await context.replyText('已調整註冊狀態');
    }
    return props.next;
  },
  messageHandler: async () => {
    return chain([
      linebot.switchAuthentication, //Only in develope
      linebot.authenticate,
      linebot.messageRouter,
    ]);
  },
  messageRouter: async () => {
    return router([text('*', linebot.mainMenu)]);
  },
  mainMenu: async (context) => {
    if (context.event.isText) {
      await context.replyText('歡迎使用鴨稅錢，請點選以下功能:');
      await context.replyTemplate('主要功能', {
        type: 'buttons',
        thumbnailImageUrl:
          // Wait for change
          'https://www.shutterstock.com/image-vector/cute-cartoon-rubber-duck-vector-600nw-2276837591.jpg',
        title: '功能清單',
        text: '請選擇以下功能',
        actions: [
          {
            type: 'postback',
            label: '查詢會計資料',
            data: `action=${linebot.postBackRoutes.chooseTable.name}`,
            displayText: '查詢會計資料',
          },
        ],
      });
    }
  },
  dataNotFound: async (context) => {
    await context.replyText('系統查無相關資料\n請重新查詢或與管理員聯絡');
  },
  postBackHandler: async () => {
    return chain([linebot.authenticate, linebot.postBackRouter]);
  },
  postBackRouter: async (context) => {
    const postback = querystring.parse(context.event.payload);
    if (linebot.postBackRoutes[postback.action]) {
      return linebot.postBackRoutes[postback.action];
    }
    console.error('Someone called postback in wrong way');
    console.error(postback);
  },
  postBackRoutes: {
    queryData: async (context) => {
      //Final step: Use <table_name>, <company_id>, <year> to query
      const postback = querystring.parse(context.event.payload);
      const table = postback.table;
      const companyId = postback.companyId;
      const year = postback.year;
      let query = `
      SELECT url FROM ${table} WHERE company_id = $companyId AND year = $year;
      `; //Table name can't be parameterized;
      let params = {
        $companyId: companyId,
        $year: year,
      };
      if (table === 'registrations') {
        // Since the date of registraions is in format of yyyy-mm-dd, query and params should be different
      }
      const results = await runQuery(query, params);
      if (results.length === 0) {
        return linebot.dataNotFound;
      }
      for (let result of results) {
        await context.replyText(result.url);
      }
    },
    chooseYear: async (context) => {
      //Third step: Choose data year
      const postback = querystring.parse(context.event.payload);
      const table = postback.table;
      const companyId = postback.companyId;
      // Show recent years to user for choosing
      const numOfYears = 3; // Should not more than the max number of buttons template, which is 4
      const currentYear = new Date().getFullYear();
      const altText = '請選擇查詢年份';
      const template = {
        type: 'buttons',
        title: '年份',
        text: '請選擇查詢年份',
      };
      const actions = [];
      for (let i = 0; i < numOfYears; i++) {
        const year = currentYear - i;
        actions.push({
          type: 'postback',
          label: `${year}`,
          data: `action=${linebot.postBackRoutes.queryData.name}&table=${table}&companyId=${companyId}&year=${year}`,
          displayText: `查詢年份: ${year}`,
        });
      }
      template.actions = actions;
      await context.replyTemplate(altText, template);
    },
    chooseCompany: async (context) => {
      // Second step: Choose which company for query
      const postback = querystring.parse(context.event.payload);
      const table = postback.table;
      const lineId = context.event.source.userId;
      const query = `
      SELECT companies.id, companies.business_id, companies.name
      FROM companies
      JOIN user_company_associations
      JOIN users
      ON companies.id = user_company_associations.company_id AND users.id = user_company_associations.user_id
      WHERE users.line_id = $lineId;
      `;
      const params = { $lineId: lineId };
      const companies = await runQuery(query, params);
      const numOfCompanies = companies.length;
      if (numOfCompanies === 0) {
        return linebot.dataNotFound;
      }
      // Generate templates and reply
      const maxNumInOneTemplate = 4; // A template can only have 4 buttons
      const numOfTemplate = Math.ceil(numOfCompanies / maxNumInOneTemplate);
      for (let i = 0; i < numOfTemplate; i++) {
        const altText = '請選擇公司';
        const template = {
          type: 'buttons',
          title: '公司列表',
          text: '請選擇要查詢的公司',
        };
        const actions = [];
        for (
          let j = 0;
          j < maxNumInOneTemplate &&
          i * maxNumInOneTemplate + j < numOfCompanies;
          j++
        ) {
          const company = companies[i * maxNumInOneTemplate + j];
          actions.push({
            type: 'postback',
            label: `${company.name}`,
            data: `action=${linebot.postBackRoutes.chooseYear.name}&table=${table}&companyId=${company.id}`,
            displayText: `查詢公司: ${company.name}(統編: ${company.business_id})`,
          });
        }
        template.actions = actions;
        await context.replyTemplate(altText, template);
      }
    },
    chooseTable: async (context) => {
      // First step: Choose which table for query
      const altText = '請選擇要查詢的會計資料';
      const template = {
        type: 'buttons',
        title: '查詢會計資料',
        text: '請選擇要查詢的資料類別',
        actions: [
          {
            type: 'postback',
            label: '營所稅',
            data: `action=${linebot.postBackRoutes.chooseCompany.name}&table=business_income_taxes`, //action is the function name of postBackRoutes
            displayText: '查詢營所稅',
          },
          {
            type: 'postback',
            label: '營業稅',
            data: `action=${linebot.postBackRoutes.chooseCompany.name}&table=value_added_taxes`,
            displayText: '查詢營業稅',
          },
          {
            type: 'postback',
            label: '工商登記',
            data: `action=${linebot.postBackRoutes.chooseCompany.name}&table=registrations`,
            displayText: '查詢工商登記',
          },
        ],
      };
      await context.replyTemplate(altText, template);
    },
  },
};

module.exports = router([
  line.follow(linebot.firstMeet),
  line.message(linebot.messageHandler), // Handling line msg
  line.postback(linebot.postBackHandler),
  // Wait for set unfollow routes: send notify to admin to delete the user line_id in the database
  // line.unfollow(),
]);
