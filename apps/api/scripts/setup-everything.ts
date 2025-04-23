import { spawn, exec } from 'child_process';
import * as readline from 'readline';
import * as os from 'os';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to execute shell commands
function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`);
        console.error(stderr);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Helper function to run a command and stream the output
function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);

    let outputData = '';

    const childProcess = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'inherit'],
      shell: os.platform() === 'win32', // Use shell on Windows
    });

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        process.stdout.write(output); // Show output
        outputData += output; // Capture output
      });
    }

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve(outputData);
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to prompt for user input
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to generate a random secure password
function generateRandomPassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor((crypto.randomBytes(1)[0] / 255) * charset.length);
    password += charset[randomIndex];
  }

  return password;
}

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

async function setupEverything() {
  try {
    console.log('=============================================================');
    console.log('Starting complete setup of the Trading Simulator Server');
    console.log('=============================================================\n');

    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Collect admin credentials at the beginning
    console.log('\n📝 Admin Account Setup Information');
    console.log('=============================================================');
    console.log('These credentials will be used to access the admin dashboard.');

    let adminUsername = await prompt(rl, 'Enter admin username (default: admin): ');
    adminUsername = adminUsername || 'admin';

    let adminEmail = await prompt(rl, 'Enter admin email (default: admin@example.com): ');
    adminEmail = adminEmail || 'admin@example.com';

    const useGeneratedPassword = await prompt(
      rl,
      'Generate a secure random password? (y/n, default: y): ',
    );
    let adminPassword = '';

    if (useGeneratedPassword.toLowerCase() !== 'n') {
      adminPassword = generateRandomPassword();
      console.log(`Generated password: ${adminPassword}`);
    } else {
      adminPassword = await prompt(rl, 'Enter admin password: ');
      if (!adminPassword) {
        console.log('Password cannot be empty. Using a generated password instead.');
        adminPassword = generateRandomPassword();
        console.log(`Generated password: ${adminPassword}`);
      }
    }

    console.log('\nAdmin account will be created with:');
    console.log(`Username: ${adminUsername}`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);

    const confirmSetup = await prompt(rl, '\nContinue with setup? (y/n, default: y): ');
    if (confirmSetup.toLowerCase() === 'n') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }

    // Close readline as we don't need it anymore for the automated steps
    rl.close();

    // Step 1: Generate secrets
    console.log('\n📦 STEP 1: Generating secrets...');
    await runCommand('npm', ['run', 'generate:secrets']);

    // Step 2: Initialize database
    console.log('\n📦 STEP 2: Initializing database...');
    await runCommand('npm', ['run', 'db:init']);

    // Step 3: Build the application
    console.log('\n📦 STEP 3: Building the application...');
    await runCommand('npm', ['run', 'build']);

    // Step 4: Start the server temporarily
    console.log('\n📦 STEP 4: Starting server temporarily for admin setup...');

    const server = spawn('npm', ['run', 'start'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Store server PID for later termination
    const serverPid = server.pid;
    if (!serverPid) {
      throw new Error('Failed to get server process ID');
    }

    let serverOutput = '';
    if (server.stdout) {
      server.stdout.on('data', (data) => {
        const output = data.toString();
        process.stdout.write(output);
        serverOutput += output;
      });
    }

    if (server.stderr) {
      server.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    }

    // Give the server some time to start
    console.log('Waiting for server to start...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if the server started successfully
    if (!serverOutput.includes('Server is running') && !serverOutput.includes('listening')) {
      throw new Error('Server failed to start properly');
    }

    // Step 5: Setup admin account and capture API key
    console.log('\n📦 STEP 5: Setting up admin account...');

    let adminApiKey = '';
    try {
      // Pass the collected admin credentials as command line arguments and capture output
      const setupOutput = await runCommand('npm', [
        'run',
        'setup:admin',
        '--',
        adminUsername,
        adminPassword,
        adminEmail,
      ]);

      // Extract API key from the setup output
      const apiKeyMatch = setupOutput.match(/API Key: ([a-f0-9_]+)/);
      if (apiKeyMatch && apiKeyMatch[1]) {
        adminApiKey = apiKeyMatch[1];
        console.log(`${colors.green}Successfully extracted admin API key!${colors.reset}`);
      } else {
        console.warn(
          `${colors.yellow}Warning: Could not extract admin API key from setup output${colors.reset}`,
        );
      }
    } catch (error) {
      console.error('Error setting up admin account:', error);
      console.log('Continuing with setup process...');
    }

    // Step 6: Stop the temporary server
    console.log('\n📦 STEP 6: Stopping temporary server...');
    if (process.platform === 'win32') {
      try {
        await executeCommand(`taskkill /F /T /PID ${serverPid}`);
      } catch (error) {
        console.error('Error stopping the server:', error);
      }
    } else {
      process.kill(-serverPid, 'SIGINT');
    }

    // // Step 7: Save credentials to a secure file
    // if (adminApiKey) {
    //   console.log('\n📦 STEP 7: Saving credentials to a secure file...');
    //   const credentialsFolder = path.join(process.cwd(), '.credentials');

    //   // Create credentials directory if it doesn't exist
    //   if (!fs.existsSync(credentialsFolder)) {
    //     fs.mkdirSync(credentialsFolder);
    //   }

    //   // Generate a timestamped filename
    //   const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
    //   const credentialsFile = path.join(credentialsFolder, `admin_credentials_${timestamp}.json`);

    //   // Write credentials to file
    //   fs.writeFileSync(
    //     credentialsFile,
    //     JSON.stringify({
    //       username: adminUsername,
    //       email: adminEmail,
    //       password: adminPassword,
    //       apiKey: adminApiKey,
    //       created: new Date().toISOString()
    //     }, null, 2),
    //     { mode: 0o600 } // Set permissions to read/write for owner only
    //   );

    //   console.log(`${colors.green}Credentials saved to: ${credentialsFile}${colors.reset}`);
    //   console.log(`${colors.yellow}IMPORTANT: This file contains sensitive information. Keep it secure!${colors.reset}`);
    // }

    // Final instructions
    console.log('\n=============================================================');
    console.log('🎉 SETUP COMPLETE!');
    console.log('=============================================================\n');
    console.log('Your Trading Simulator Server is now set up and ready to use.');
    console.log('\nAdmin Credentials - SAVE THESE:');
    console.log('----------------------------------------');
    console.log(`Username: ${adminUsername}`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    if (adminApiKey) {
      console.log(`API Key: ${adminApiKey} - THIS WILL NOT BE SHOWN AGAIN`);
    } else {
      console.log('API Key: [NOT CAPTURED - Please check command output above]');
    }
    console.log('----------------------------------------\n');
    console.log('To start the server, run:');
    console.log('  npm run start\n');
    console.log('You can then access the API at: http://localhost:3000');
    console.log('=============================================================\n');
  } catch (error) {
    console.error('Error during setup:', error);
    process.exit(1);
  }
}

// Run the setup
setupEverything().catch(console.error);
