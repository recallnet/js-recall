import axios from 'axios';
import * as readline from 'readline';
import * as crypto from 'crypto';
import { config } from '../src/config';

// Create readline interface for prompting user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Colors for console output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

// Prompt function that returns a promise
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Password prompt function (doesn't show characters)
async function promptPassword(question: string): Promise<string> {
  process.stdout.write(question);
  const password = await new Promise<string>((resolve) => {
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      const byteArray = [...key];

      // If user presses Ctrl+C, exit
      if (byteArray.length === 1 && byteArray[0] === 3) {
        console.log('\nSetup cancelled.');
        process.exit(1);
      }

      // If user presses Enter, we're done
      if (byteArray.length === 1 && byteArray[0] === 13) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        console.log(''); // new line after password
        resolve(input);
        return;
      }

      // If user presses backspace, remove last character
      if (byteArray.length === 1 && (byteArray[0] === 8 || byteArray[0] === 127)) {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b'); // erase last character
        }
        return;
      }

      // Otherwise, add character to password and show *
      const char = key.toString();
      input += char;
      process.stdout.write('*');
    });
  });

  return password;
}

// Generate a random password if none is provided
function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor((crypto.randomBytes(1)[0] / 255) * charset.length);
    password += charset[randomIndex];
  }

  return password;
}

async function setupAdmin() {
  try {
    // Banner with clear visual separation
    console.log('\n\n');
    console.log(
      `${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.magenta}║                         ADMIN SETUP                           ║${colors.reset}`,
    );
    console.log(
      `${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(`\n${colors.cyan}Setting up admin account...${colors.reset}`);

    // Get admin details from command line arguments or prompt for them
    let username = process.argv[2];
    let password = process.argv[3];
    let email = process.argv[4];

    if (!username) {
      username = await prompt(
        `${colors.cyan}Enter admin username (default: admin): ${colors.reset}`,
      );
      username = username || 'admin';
    }

    if (!password) {
      const useGenerated = await prompt(
        `${colors.cyan}Generate random password? (y/n, default: y): ${colors.reset}`,
      );

      if (useGenerated.toLowerCase() !== 'n') {
        password = generateRandomPassword();
        console.log(`${colors.green}Generated password: ${password}${colors.reset}`);
      } else {
        password = await promptPassword(`${colors.cyan}Enter admin password: ${colors.reset}`);
        const confirmPassword = await promptPassword(
          `${colors.cyan}Confirm admin password: ${colors.reset}`,
        );

        if (password !== confirmPassword) {
          console.error(`${colors.red}Passwords do not match. Please try again.${colors.reset}`);
          rl.close();
          return;
        }
      }
    }

    if (!email) {
      email = await prompt(
        `${colors.cyan}Enter admin email (default: admin@example.com): ${colors.reset}`,
      );
      email = email || 'admin@example.com';
    }

    // Use the admin setup endpoint to create a new admin account
    const port = config.server.port || 3000;
    const baseUrl = `http://localhost:${port}`;

    console.log(`${colors.blue}Attempting to connect to server at ${baseUrl}...${colors.reset}`);

    // Wait for server to be available (maximum 30 seconds)
    let serverAvailable = false;
    for (let i = 0; i < 30; i++) {
      try {
        await axios.get(`${baseUrl}/api/health`);
        serverAvailable = true;
        break;
      } catch (error) {
        process.stdout.write('.');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!serverAvailable) {
      console.error(
        `\n${colors.red}Could not connect to server after 30 seconds. Please ensure the server is running and try again.${colors.reset}`,
      );
      rl.close();
      return;
    }

    console.log(`\n${colors.green}Server is up! Creating admin account...${colors.reset}`);

    // Send the request to create admin and CAPTURE THE RESPONSE
    const response = await axios.post(`${baseUrl}/api/admin/setup`, {
      username,
      password,
      email,
    });

    // Extract the API key from the response
    const adminApiKey = response.data.admin.apiKey;

    console.log(`\n${colors.green}✓ Admin account created successfully!${colors.reset}`);
    console.log(`\n${colors.cyan}Admin Account Details:${colors.reset}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);

    console.log(`\n${colors.yellow}API Key (SAVE THIS SECURELY):${colors.reset}`);
    console.log(`${colors.yellow}----------------------------------------${colors.reset}`);
    console.log(`API Key: ${adminApiKey}`);
    console.log(`${colors.yellow}----------------------------------------${colors.reset}`);

    console.log(`\n${colors.red}IMPORTANT: The API Key will only be shown once!${colors.reset}`);
    console.log(`${colors.red}Make sure to securely store this API key.${colors.reset}`);
    console.log('\nYou can now use this API key to authenticate admin requests:');
    console.log(`${colors.blue}Authorization: Bearer ${adminApiKey}${colors.reset}`);

    console.log(
      `\n${colors.green}You can now log in with these credentials to manage the trading simulator.${colors.reset}`,
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `\n${colors.red}Error setting up admin account: ${error.response.data.message || error.response.data.error || error.message}${colors.reset}`,
      );

      if (
        error.response.status === 403 &&
        error.response.data.message?.includes('admin account already exists')
      ) {
        console.log(
          `\n${colors.yellow}An admin account already exists. You can use the existing admin account to manage the trading simulator.${colors.reset}`,
        );
      }
    } else {
      console.error(`\n${colors.red}Error setting up admin account:${colors.reset}`, error);
    }
  } finally {
    rl.close();
  }
}

// Run the setup function
setupAdmin();
