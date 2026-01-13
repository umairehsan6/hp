// Configuration for API endpoint
// Change this to your backend URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'  // Local development
    : 'http://localhost:8000';  // Production - UPDATE THIS to your PC's public IP or ngrok URL

export default API_BASE_URL;
