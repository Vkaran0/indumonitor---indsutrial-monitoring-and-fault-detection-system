// Supabase Configuration
const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'your-anon-key'; // Replace with your Supabase anon key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
let currentPage = window.location.pathname;

// Initialize based on current page
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Initialize page-specific functionality
    if (currentPage.includes('index.html') || currentPage.endsWith('/')) {
        initLoginPage();
    } else if (currentPage.includes('register.html')) {
        initRegisterPage();
    } else if (currentPage.includes('dashboard.html')) {
        initDashboardPage();
    }
    
    // Set current date
    setCurrentDate();
});

// Check authentication status
async function checkAuthStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Redirect logic based on current page and auth status
    if (session && (currentPage.includes('index.html') || currentPage.includes('register.html'))) {
        // User is logged in and trying to access login/register pages
        window.location.href = 'dashboard.html';
    } else if (!session && currentPage.includes('dashboard.html')) {
        // User is not logged in and trying to access dashboard
        window.location.href = 'index.html';
    }
    
    return session;
}

// Initialize Login Page
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }
    
    // Demo login for testing
    document.getElementById('loginBtn')?.addEventListener('click', function(e) {
        if (e.target.closest('form')) return; // Let form submission handle it
        
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        
        if (!email || !password) {
            // Auto-fill demo credentials
            document.getElementById('email').value = 'demo@indu.com';
            document.getElementById('password').value = 'demo123';
        }
    });
}

// Initialize Register Page
function initRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const regPasswordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
        
        // Password validation on input
        regPasswordInput?.addEventListener('input', validatePassword);
        confirmPasswordInput?.addEventListener('input', validateConfirmPassword);
    }
    
    if (toggleRegPassword && regPasswordInput) {
        toggleRegPassword.addEventListener('click', function() {
            const type = regPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            regPasswordInput.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }
    
    if (toggleConfirmPassword && confirmPasswordInput) {
        toggleConfirmPassword.addEventListener('click', function() {
            const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            confirmPasswordInput.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }
}

// Initialize Dashboard Page
function initDashboardPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Load user data
    loadUserData();
}

// Handle User Login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Reset messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Basic validation
    if (!email || !password) {
        showError(errorMessage, 'Please fill in all fields');
        return;
    }
    
    // Update button state
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    loginBtn.disabled = true;
    
    try {
        // For demo purposes - bypass Supabase with demo credentials
        if (email === 'demo@indu.com' && password === 'demo123') {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Store demo session in localStorage
            localStorage.setItem('indu_demo_user', JSON.stringify({
                email: 'demo@indu.com',
                name: 'Demo User',
                created_at: new Date().toISOString()
            }));
            
            // Show success and redirect
            showSuccess(successMessage, 'Login successful! Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            return;
        }
        
        // Real Supabase authentication
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Show success and redirect
        showSuccess(successMessage, 'Login successful! Redirecting to dashboard...');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showError(errorMessage, error.message || 'Invalid email or password. Please try again.');
    } finally {
        // Restore button state
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// Handle User Registration
async function handleRegistration(e) {
    e.preventDefault();
    
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    const registerBtn = document.getElementById('registerBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Reset messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showError(errorMessage, 'Please fill in all fields');
        return;
    }
    
    if (!agreeTerms) {
        showError(errorMessage, 'You must agree to the Terms of Service and Privacy Policy');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(errorMessage, 'Passwords do not match');
        return;
    }
    
    if (!validatePasswordStrength(password)) {
        showError(errorMessage, 'Password does not meet the requirements');
        return;
    }
    
    // Update button state
    const originalText = registerBtn.innerHTML;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    registerBtn.disabled = true;
    
    try {
        // For demo purposes - simulate registration
        // In a real app, you would use Supabase auth.signUp()
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Simulate successful registration
        showSuccess(successMessage, 'Account created successfully! Redirecting to login...');
        
        // Redirect to login after delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
        /*
        // Real Supabase registration code (uncomment and configure)
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name
                }
            }
        });
        
        if (error) throw error;
        
        showSuccess(successMessage, 'Account created successfully! Please check your email to confirm your account.');
        */
        
    } catch (error) {
        console.error('Registration error:', error);
        showError(errorMessage, error.message || 'Registration failed. Please try again.');
    } finally {
        // Restore button state
        registerBtn.innerHTML = originalText;
        registerBtn.disabled = false;
    }
}

// Handle User Logout
async function handleLogout() {
    try {
        // Clear demo session
        localStorage.removeItem('indu_demo_user');
        
        // Supabase logout
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Redirect to login page
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect even if there's an error
        window.location.href = 'index.html';
    }
}

// Load User Data for Dashboard
async function loadUserData() {
    try {
        // Check for demo user
        const demoUser = localStorage.getItem('indu_demo_user');
        if (demoUser) {
            const userData = JSON.parse(demoUser);
            document.getElementById('userName').textContent = userData.name || 'Demo User';
            document.getElementById('userEmail').textContent = userData.email;
            return;
        }
        
        // Get current user from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
            document.getElementById('userEmail').textContent = user.email;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Password Validation
function validatePassword() {
    const password = document.getElementById('regPassword').value;
    const requirements = {
        length: document.getElementById('reqLength'),
        uppercase: document.getElementById('reqUppercase'),
        lowercase: document.getElementById('reqLowercase'),
        number: document.getElementById('reqNumber')
    };
    
    // Check each requirement
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    // Update UI
    updateRequirementClass(requirements.length, hasLength);
    updateRequirementClass(requirements.uppercase, hasUppercase);
    updateRequirementClass(requirements.lowercase, hasLowercase);
    updateRequirementClass(requirements.number, hasNumber);
    
    return hasLength && hasUppercase && hasLowercase && hasNumber;
}

function updateRequirementClass(element, isValid) {
    if (isValid) {
        element.classList.add('valid');
        element.style.color = '#51cf66';
    } else {
        element.classList.remove('valid');
        element.style.color = '#868e96';
    }
}

function validatePasswordStrength(password) {
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasLength && hasUppercase && hasLowercase && hasNumber;
}

function validateConfirmPassword() {
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (confirmPassword && password !== confirmPassword) {
        document.getElementById('confirmPassword').style.borderColor = '#f44336';
        return false;
    } else if (confirmPassword && password === confirmPassword) {
        document.getElementById('confirmPassword').style.borderColor = '#4CAF50';
        return true;
    }
    
    return false;
}

// Utility Functions
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function showSuccess(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function setCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dateElement.textContent = now.toLocaleDateString('en-US', options);
    }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN') {
        console.log('User signed in:', session.user.email);
    } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
    }
});