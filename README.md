1. Install Node.js (v18 or higher)
   Download from: https://nodejs.org/

2. Install Git
   Download from: https://git-scm.com/


git clone <your-github-repo-url>
cd itcp239-s-2026

# Install frontend dependencies
npm install
cd itcp239-s-2026

# Install backend dependencies
cd itcp239-s-2026
cd server
npm install


ENV FILE

JWT_SECRET=5bc4dfff5720daca199e649a1d3e29fc
API_URL=http://192.168.237.1:4000 // ung ip add mo
EXPO_ACCESS_TOKEN=zHcvl4gClNEMz_uBKnQD4XXdObUai_-I4qLGuTeD


PORT=4000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=jannellayumang@gmail.com
SMTP_PASS=lsnk fozv byvl abyx


# Run this command to get IP address:
ipconfig | Select-String -Pattern "IPv4"
baseURL = 'http://[THEIR_IP_ADDRESS]:4000/api/v1/';

frontend start
npx expo start
backend start
npm run dev

