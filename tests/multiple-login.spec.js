
const { chromium } = require('@playwright/test');

(async () => {
    // Launch two separate Chrome windows
    const browser1 = await chromium.launch({
        headless: false,
        channel: 'chrome'
    });

    const browser2 = await chromium.launch({
        headless: false,
        channel: 'chrome'
    });

    // Create separate pages
    const page1 = await browser1.newPage();
    const page2 = await browser2.newPage();

    // Open application simultaneously
    await Promise.all([
        page1.goto('https://qapublic.intalk.cc/intalk_new'),
        page2.goto('https://qapublic.intalk.cc/intalk_new')
    ]);

    // Login credentials
    const users = [
        {
            page: page1,
            username: 'dj_super',
            password: 'Agami@12'
        },
        {
            page: page2,
            username: 'dj_agent1',
            password: 'Agami@12'
        }
    ];

    // Perform both logins simultaneously
    await Promise.all(
        users.map(async (user) => {
            await user.page.getByRole('textbox', {
                name: 'User ID'
            }).fill(user.username);

            await user.page.getByRole('textbox', {
                name: 'Password'
            }).fill(user.password);

            await user.page.getByRole('button', {
                name: 'Login'
            }).click();
        })
    );

    console.log('Both users login process completed.');

})();
