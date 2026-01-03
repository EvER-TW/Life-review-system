/**
 * 認證模組 - Google OAuth 登入
 */

const ALLOWED_EMAILS = ['littletiger025@gmail.com'];

let currentUser = null;

// 檢查登入狀態
function checkLoginStatus() {
    const savedUser = sessionStorage.getItem('user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showApp();
            return true;
        } catch (e) {
            sessionStorage.removeItem('user');
        }
    }
    showLogin();
    return false;
}

// Google 登入回調
function handleCredentialResponse(response) {
    const payload = parseJwt(response.credential);

    if (!ALLOWED_EMAILS.includes(payload.email)) {
        document.getElementById('login-error').textContent =
            `此帳號 (${payload.email}) 無權限存取`;
        return;
    }

    currentUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
    };

    sessionStorage.setItem('user', JSON.stringify(currentUser));
    showApp();
}

// 登出
function handleLogout() {
    sessionStorage.removeItem('user');
    currentUser = null;
    showLogin();
}

// 顯示登入頁
function showLogin() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.querySelector('.app-container').style.display = 'none';
    document.querySelector('.mobile-menu-toggle').style.display = 'none';
}

// 顯示應用
function showApp() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.querySelector('.app-container').style.display = 'flex';

    // 更新使用者資訊
    if (currentUser) {
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-avatar').src = currentUser.picture || '';
        document.getElementById('user-name').textContent = currentUser.name || currentUser.email;
    }

    // 觸發登入成功事件
    window.dispatchEvent(new Event('userLoggedIn'));
}

// 解析 JWT
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
}

// 取得當前使用者
function getCurrentUser() {
    return currentUser;
}

// 暴露到全域
window.handleCredentialResponse = handleCredentialResponse;
window.handleLogout = handleLogout;

export { checkLoginStatus, getCurrentUser };
