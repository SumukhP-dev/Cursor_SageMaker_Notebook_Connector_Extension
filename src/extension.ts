import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  console.log("SageMaker Remote Connection extension is now active!");

  // Register commands
  const connectCommand = vscode.commands.registerCommand(
    "sagemaker-remote.connect",
    async () => {
      await connectToSageMaker(context);
    }
  );

  const checkStatusCommand = vscode.commands.registerCommand(
    "sagemaker-remote.checkStatus",
    async () => {
      await checkConnectionStatus();
    }
  );

  const debugSSHConfigCommand = vscode.commands.registerCommand(
    "sagemaker-remote.debugSSHConfig",
    async () => {
      await debugSSHConfig();
    }
  );

  const setupCommand = vscode.commands.registerCommand(
    "sagemaker-remote.setup",
    async () => {
      await setupSageMakerConnection(context);
    }
  );

  const startServerCommand = vscode.commands.registerCommand(
    "sagemaker-remote.startServer",
    async () => {
      await startLocalServer();
    }
  );

  const diagnoseCommand = vscode.commands.registerCommand(
    "sagemaker-remote.diagnose",
    async () => {
      await diagnoseConnection();
    }
  );

  const fixArnConversionCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixArnConversion",
    async () => {
      await fixArnConversion();
    }
  );

  const fixCodeWrapperCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixCodeWrapper",
    async () => {
      await fixCodeWrapper();
    }
  );

  const fixSshConfigCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixSshConfig",
    async () => {
      await fixSshConfig();
    }
  );

  const applyAllFixesCommand = vscode.commands.registerCommand(
    "sagemaker-remote.applyAllFixes",
    async () => {
      await applyAllFixes();
    }
  );

  const quickStartCommand = vscode.commands.registerCommand(
    "sagemaker-remote.quickStart",
    async () => {
      await quickStartSageMaker(context);
    }
  );

  context.subscriptions.push(
    connectCommand,
    checkStatusCommand,
    setupCommand,
    debugSSHConfigCommand,
    startServerCommand,
    diagnoseCommand,
    fixArnConversionCommand,
    fixCodeWrapperCommand,
    fixSshConfigCommand,
    applyAllFixesCommand,
    quickStartCommand
  );
}

async function connectToSageMaker(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
  outputChannel.show();

  try {
    outputChannel.appendLine("Connecting to SageMaker...");

    // Check prerequisites
    const checks = await checkPrerequisites();
    if (!checks.allPassed) {
      vscode.window.showErrorMessage(
        `Prerequisites not met: ${checks.errors.join(", ")}`
      );
      return;
    }

    // CRITICAL: Check local server BEFORE attempting connection
    // The PowerShell ProxyCommand requires the local server to be running
    outputChannel.appendLine("\n🔍 Checking local server status...");
    const serverInfo = await checkServerStatus();

    if (!serverInfo.running) {
      outputChannel.appendLine("\n❌ ERROR: Local server is NOT running!");
      outputChannel.appendLine(
        "   The connection will FAIL. You MUST start the server first."
      );

      // Check if code wrapper issue might be preventing server start
      outputChannel.appendLine("\n🔍 Diagnosing server start issue...");
      const codeWrapperIssue = await checkCodeWrapperIssue();
      if (codeWrapperIssue.hasIssue) {
        outputChannel.appendLine(
          "\n⚠️  FOUND ISSUE: Code wrapper problem detected!"
        );
        outputChannel.appendLine(`   ${codeWrapperIssue.message}`);
        outputChannel.appendLine(
          "\n💡 This is likely preventing AWS Toolkit from starting the server."
        );
        outputChannel.appendLine(
          "   AWS Toolkit tries to use 'code --folder-uri' which Cursor doesn't support."
        );
        outputChannel.appendLine("\n📋 Fix the code wrapper:");
        outputChannel.appendLine(
          "   1. Run: .\\scripts\\fix_cursor_code_command.ps1"
        );
        outputChannel.appendLine("   2. Restart Cursor completely");
        outputChannel.appendLine("   3. Try starting the server again");
      }

      outputChannel.appendLine("\n📋 Steps to start the server:");
      outputChannel.appendLine(
        "   METHOD 1: Use extension command (recommended)"
      );
      outputChannel.appendLine(
        "   1. Press F1 → 'SageMaker: Start Local Server'"
      );
      outputChannel.appendLine(
        "   2. This will try to trigger AWS Toolkit to start the server"
      );
      outputChannel.appendLine("\n   METHOD 2: Use AWS Toolkit UI");
      outputChannel.appendLine(
        "   1. Open AWS Toolkit sidebar (click AWS icon in left sidebar)"
      );
      outputChannel.appendLine("   2. Find your SageMaker Space in the list");
      outputChannel.appendLine(
        "   3. Right-click the Space (NOT the app) → 'Open Remote Connection'"
      );
      outputChannel.appendLine("   4. Wait for server to start (5-10 seconds)");
      outputChannel.appendLine(
        "   5. You should see a notification: 'Local server started'"
      );
      outputChannel.appendLine(
        "   6. Verify with: F1 → 'SageMaker: Check SageMaker Connection Status'"
      );
      outputChannel.appendLine("   7. Then try connecting again");

      const action = await vscode.window.showErrorMessage(
        "Local server not running. Start it first, then try connecting again.",
        "Start Server",
        "Check Status",
        "Open AWS Toolkit",
        "Fix Code Wrapper"
      );

      if (action === "Start Server") {
        vscode.commands.executeCommand("sagemaker-remote.startServer");
      } else if (action === "Check Status") {
        vscode.commands.executeCommand("sagemaker-remote.checkStatus");
      } else if (action === "Open AWS Toolkit") {
        // Try to focus AWS Toolkit view
        await vscode.commands.executeCommand(
          "workbench.view.extension.aws-toolkit"
        );
      } else if (action === "Fix Code Wrapper") {
        // Open terminal and run the fix script
        const terminal = vscode.window.createTerminal("Fix Code Wrapper");
        // Try to find the script relative to workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let scriptPath = "";
        if (workspaceFolders && workspaceFolders.length > 0) {
          scriptPath = path.join(
            workspaceFolders[0].uri.fsPath,
            "scripts",
            "fix_cursor_code_command.ps1"
          );
        } else {
          // Fallback to hardcoded path
          scriptPath = path.join(
            process.env.USERPROFILE || "",
            "OneDrive - Georgia Institute of Technology",
            "Projects",
            "Dream_Flow_Flutter_App",
            "dream_flow",
            "notebooks",
            "scripts",
            "fix_cursor_code_command.ps1"
          );
        }
        terminal.sendText(
          `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        );
        terminal.show();
        vscode.window.showInformationMessage(
          "Running code wrapper fix script. Check the terminal for output."
        );
      }

      return; // Don't continue - server must be running
    } else {
      // Server info file exists, but verify it's actually running and accessible
      if (serverInfo.accessible === false || !serverInfo.running) {
        outputChannel.appendLine(
          `\n⚠️  WARNING: Server info file exists but server is not running or accessible!`
        );
        outputChannel.appendLine(
          `   PID: ${serverInfo.pid}, Port: ${serverInfo.port}`
        );
        if (serverInfo.error) {
          outputChannel.appendLine(`   Error: ${serverInfo.error}`);
        }
        outputChannel.appendLine(
          "\n💡 The server process has stopped (this is common). Restart it:"
        );
        outputChannel.appendLine(
          "   1. Open AWS Toolkit sidebar (click AWS icon)"
        );
        outputChannel.appendLine("   2. Find your SageMaker Space in the list");
        outputChannel.appendLine(
          "   3. Right-click the Space (NOT the app) → 'Open Remote Connection'"
        );
        outputChannel.appendLine(
          "   4. Wait 5-10 seconds for server to restart"
        );
        outputChannel.appendLine(
          "   5. You should see a notification: 'Local server started'"
        );

        const action = await vscode.window.showWarningMessage(
          "Server exists but is not accessible. Restart the server via AWS Toolkit.",
          "Check Status",
          "Open AWS Toolkit"
        );

        if (action === "Check Status") {
          vscode.commands.executeCommand("sagemaker-remote.checkStatus");
        } else if (action === "Open AWS Toolkit") {
          await vscode.commands.executeCommand(
            "workbench.view.extension.aws-toolkit"
          );
        }

        return; // Don't continue if server isn't accessible
      }

      outputChannel.appendLine(
        `✅ Local server is running and accessible (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
      );

      // CRITICAL: Verify server is still running RIGHT BEFORE connecting
      // The server can stop between the initial check and the connection attempt
      outputChannel.appendLine("\n🔍 Final verification: Checking server is still running...");
      const finalCheck = await checkServerStatus();
      if (!finalCheck.running || !finalCheck.accessible) {
        outputChannel.appendLine("\n❌ ERROR: Server stopped after initial check!");
        outputChannel.appendLine(
          "   The server was running but stopped before connection attempt."
        );
        outputChannel.appendLine(
          "\n💡 This happens when the server process stops between checks."
        );
        outputChannel.appendLine(
          "   Please restart the server via AWS Toolkit and try again."
        );
        outputChannel.appendLine("\n📋 Steps to restart:");
        outputChannel.appendLine(
          "   1. Open AWS Toolkit sidebar (click AWS icon)"
        );
        outputChannel.appendLine("   2. Navigate to: SageMaker AI → Studio → Domain → SPACES");
        outputChannel.appendLine(
          "   3. Right-click on SPACE 'quickstart-gpu-zb6owr' (NOT the app)"
        );
        outputChannel.appendLine("   4. Click: 'Open Remote Connection'");
        outputChannel.appendLine("   5. Wait 10-15 seconds for server to start");
        outputChannel.appendLine("   6. Then try connecting again");

        const action = await vscode.window.showErrorMessage(
          "Server stopped before connection. Restart the server via AWS Toolkit.",
          "Open AWS Toolkit",
          "Check Status"
        );

        if (action === "Open AWS Toolkit") {
          await vscode.commands.executeCommand(
            "workbench.view.extension.aws-toolkit"
          );
        } else if (action === "Check Status") {
          vscode.commands.executeCommand("sagemaker-remote.checkStatus");
        }

        return; // Don't continue - server must be running
      }

      outputChannel.appendLine("✅ Server verified - still running and accessible");

      // Verify the PowerShell script exists
      const scriptPath = path.join(
        process.env.APPDATA || "",
        "Cursor",
        "User",
        "globalStorage",
        "amazonwebservices.aws-toolkit-vscode",
        "sagemaker_connect.ps1"
      );

      if (!fs.existsSync(scriptPath)) {
        outputChannel.appendLine(
          `\n⚠️  WARNING: PowerShell script not found: ${scriptPath}`
        );
        outputChannel.appendLine(
          "   This script is created by AWS Toolkit when you start the server."
        );
        outputChannel.appendLine(
          "   Try restarting the local server via AWS Toolkit."
        );
        const scriptAction = await vscode.window.showWarningMessage(
          "PowerShell script not found. Restart the local server via AWS Toolkit.",
          "Check Status"
        );
        if (scriptAction === "Check Status") {
          vscode.commands.executeCommand("sagemaker-remote.checkStatus");
        }
        return; // Don't continue without the script
      } else {
        outputChannel.appendLine(`✅ PowerShell script found: ${scriptPath}`);
      }
    }

    // Get SSH host alias from config
    const config = vscode.workspace.getConfiguration("sagemakerRemote");
    const sshHost = config.get<string>("sshHostAlias", "sagemaker");

    outputChannel.appendLine(`\nUsing SSH host: ${sshHost}`);

    // Verify Remote-SSH extension is actually available
    if (!checks.remoteSSH) {
      const errorMsg =
        "Remote-SSH extension not found. Please install it first.";
      outputChannel.appendLine(`❌ ${errorMsg}`);
      outputChannel.appendLine(
        "   Install: ms-vscode-remote.remote-ssh (VS Code) or anysphere.remote-ssh (Cursor)"
      );
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    // Detect which Remote-SSH extension is installed
    const remoteSSH_VSCode = vscode.extensions.getExtension(
      "ms-vscode-remote.remote-ssh"
    );
    const remoteSSH_Cursor = vscode.extensions.getExtension(
      "anysphere.remote-ssh"
    );

    let remoteSSHExtensionName = "Unknown";
    if (remoteSSH_Cursor) {
      remoteSSHExtensionName = "Cursor Remote-SSH (anysphere.remote-ssh)";
    } else if (remoteSSH_VSCode) {
      remoteSSHExtensionName =
        "VS Code Remote-SSH (ms-vscode-remote.remote-ssh)";
    }

    outputChannel.appendLine(
      `Detected Remote-SSH extension: ${remoteSSHExtensionName}`
    );

    // Check available commands
    const commands = await vscode.commands.getCommands();

    // Try different command variations
    // Cursor uses opensshremotes.* prefix, VS Code uses remote-ssh.*
    let connectCommand: string | null = null;

    if (remoteSSH_Cursor) {
      // Cursor Remote-SSH commands
      // Try standard Remote-SSH commands first (they might work in Cursor too)
      if (commands.includes("remote-ssh.connectToHost")) {
        connectCommand = "remote-ssh.connectToHost";
      } else if (commands.includes("remote-ssh.connect")) {
        connectCommand = "remote-ssh.connect";
      } else if (commands.includes("opensshremotes.connectToHost")) {
        connectCommand = "opensshremotes.connectToHost";
      } else if (commands.includes("opensshremotes.connect")) {
        connectCommand = "opensshremotes.connect";
      } else if (commands.includes("opensshremotes.addNewSshHost")) {
        // Last resort - this opens a picker to add/select host
        connectCommand = "opensshremotes.addNewSshHost";
      }
    } else {
      // VS Code Remote-SSH commands
      if (commands.includes("remote-ssh.connect")) {
        connectCommand = "remote-ssh.connect";
      } else if (commands.includes("remote.SSH.connect")) {
        connectCommand = "remote.SSH.connect";
      } else if (commands.includes("remote-ssh.connectToHost")) {
        connectCommand = "remote-ssh.connectToHost";
      }
    }

    if (!connectCommand) {
      outputChannel.appendLine(`❌ Remote-SSH connect command not found.`);
      if (remoteSSH_Cursor) {
        outputChannel.appendLine(
          `   Available opensshremotes commands: ${commands
            .filter((cmd) => cmd.includes("opensshremotes"))
            .slice(0, 10)
            .join(", ")}`
        );
        outputChannel.appendLine(
          `\n💡 Solution: Use Command Palette to connect manually`
        );
        outputChannel.appendLine(`   1. Press F1 (or Ctrl+Shift+P)`);
        outputChannel.appendLine(`   2. Type: "Remote-SSH: Connect to Host"`);
        outputChannel.appendLine(`   3. Select "${sshHost}" from the list`);

        // Try to open Command Palette with the command pre-filled
        // Note: We can't pre-fill, but we can open it and guide the user
        outputChannel.appendLine(
          `\n📋 Opening Command Palette... Please type "Remote-SSH: Connect to Host"`
        );

        vscode.window
          .showInformationMessage(
            `Please type "Remote-SSH: Connect to Host" in the Command Palette, then select "${sshHost}"`,
            "Open Command Palette",
            "Check SSH Config"
          )
          .then((selection) => {
            if (selection === "Open Command Palette") {
              vscode.commands.executeCommand("workbench.action.showCommands");
            } else if (selection === "Check SSH Config") {
              vscode.commands.executeCommand("sagemaker-remote.checkStatus");
            }
          });

        // Open Command Palette
        await vscode.commands.executeCommand("workbench.action.showCommands");
        return;
      } else {
        outputChannel.appendLine(
          `   Available remote-ssh commands: ${commands
            .filter((cmd) => cmd.includes("remote") && cmd.includes("ssh"))
            .slice(0, 10)
            .join(", ")}`
        );
        const errorMsg =
          "Remote-SSH connect command not found. Please check the Remote-SSH extension is installed and activated.";
        vscode.window.showErrorMessage(errorMsg);
        return;
      }
    }

    outputChannel.appendLine(`Using command: ${connectCommand}`);

    // Trigger Remote-SSH connection
    try {
      // Try to connect with the hostname parameter
      // Most Remote-SSH commands accept the hostname as a parameter
      if (
        connectCommand === "remote-ssh.connectToHost" ||
        connectCommand === "remote-ssh.connect" ||
        connectCommand === "opensshremotes.connectToHost" ||
        connectCommand === "opensshremotes.connect"
      ) {
        // These commands should accept the hostname
        await vscode.commands.executeCommand(connectCommand, sshHost);
        outputChannel.appendLine(`Attempting to connect to "${sshHost}"...`);
      } else if (connectCommand === "opensshremotes.addNewSshHost") {
        // This command opens a picker - we can't pass hostname directly
        // First, verify SSH config exists and has the entry
        const sshConfigPath = path.join(
          process.env.USERPROFILE || "",
          ".ssh",
          "config"
        );

        let sshConfigExists = false;
        let sshConfigHasHost = false;
        let sshConfigContent = "";

        if (fs.existsSync(sshConfigPath)) {
          sshConfigExists = true;
          sshConfigContent = fs.readFileSync(sshConfigPath, "utf8");
          sshConfigHasHost = sshConfigContent.includes(`Host ${sshHost}`);
        }

        outputChannel.appendLine(`\n📋 SSH Config Status:`);
        outputChannel.appendLine(
          `   Config file exists: ${sshConfigExists ? "✅" : "❌"}`
        );
        outputChannel.appendLine(`   Config path: ${sshConfigPath}`);

        if (sshConfigExists) {
          outputChannel.appendLine(
            `   Contains "Host ${sshHost}": ${sshConfigHasHost ? "✅" : "❌"}`
          );

          if (!sshConfigHasHost) {
            outputChannel.appendLine(
              `\n❌ SSH config doesn't contain "Host ${sshHost}" entry!`
            );
            outputChannel.appendLine(
              `   Please run: "SageMaker: Setup SageMaker Connection"`
            );
            vscode.window
              .showErrorMessage(
                `SSH config missing "${sshHost}" entry. Run Setup command first.`,
                "Run Setup"
              )
              .then((selection) => {
                if (selection === "Run Setup") {
                  vscode.commands.executeCommand("sagemaker-remote.setup");
                }
              });
            return;
          } else {
            // Show a snippet of the config to verify it's correct
            const hostMatch = sshConfigContent.match(
              new RegExp(`Host ${sshHost}[\\s\\S]*?(?=Host |$)`)
            );
            if (hostMatch) {
              const hostSection = hostMatch[0]
                .split("\n")
                .slice(0, 5)
                .join("\n");
              outputChannel.appendLine(
                `\n✅ Found SSH config entry for "${sshHost}":`
              );
              outputChannel.appendLine(`   ${hostSection}...`);
            }
            outputChannel.appendLine(
              `\n⚠️  If "${sshHost}" doesn't appear in the picker, Cursor needs to reload the SSH config.`
            );
            outputChannel.appendLine(`\n💡 Quick Fix: Reload the window now`);

            // Offer to reload the window automatically
            const reloadChoice = await vscode.window.showWarningMessage(
              `SSH config is correct but "${sshHost}" may not appear until Cursor reloads. Reload window now?`,
              "Reload Window",
              "Continue Anyway"
            );

            if (reloadChoice === "Reload Window") {
              outputChannel.appendLine(`\n🔄 Reloading Cursor window...`);
              outputChannel.appendLine(
                `   After reload, try connecting again.`
              );
              await vscode.commands.executeCommand(
                "workbench.action.reloadWindow"
              );
              return;
            }

            outputChannel.appendLine(`\n📝 If "${sshHost}" doesn't appear:`);
            outputChannel.appendLine(`   1. Close the picker (press Escape)`);
            outputChannel.appendLine(
              `   2. Reload window: Press Ctrl+R (or F1 → "Developer: Reload Window")`
            );
            outputChannel.appendLine(`   3. Then try connecting again`);
            outputChannel.appendLine(
              `   4. Or restart Cursor completely if reload doesn't work`
            );
          }
        } else {
          outputChannel.appendLine(`\n❌ SSH config file doesn't exist!`);
          outputChannel.appendLine(
            `   Please run: "SageMaker: Setup SageMaker Connection"`
          );
          vscode.window
            .showErrorMessage(
              "SSH config file not found. Run Setup command first.",
              "Run Setup"
            )
            .then((selection) => {
              if (selection === "Run Setup") {
                vscode.commands.executeCommand("sagemaker-remote.setup");
              }
            });
          return;
        }

        // For Cursor, the host might not appear in the picker even if config is correct
        // Use manual connection method directly since it works reliably
        outputChannel.appendLine(
          `\n💡 Using manual connection method (works reliably with Cursor)`
        );
        outputChannel.appendLine(`\n📝 Connection Steps:`);
        outputChannel.appendLine(`   1. Command Palette will open`);
        outputChannel.appendLine(`   2. Type: "Remote-SSH: Connect to Host"`);
        outputChannel.appendLine(`   3. Press Enter`);
        outputChannel.appendLine(
          `   4. When prompted for hostname, type: ${sshHost}`
        );
        outputChannel.appendLine(`   5. Press Enter to connect`);
        outputChannel.appendLine(
          `\n✅ This method works even if "${sshHost}" doesn't appear in the picker list.`
        );

        // Open Command Palette directly
        await vscode.commands.executeCommand("workbench.action.showCommands");

        vscode.window.showInformationMessage(
          `Type "Remote-SSH: Connect to Host", then enter "${sshHost}" as the hostname when prompted`,
          "Got it"
        );
        return;

        // Old picker method (kept for reference but not used)
        /* else if (connectionChoice === "Open Host Picker") {
          // Open the picker as before
          await vscode.commands.executeCommand(connectCommand);
          outputChannel.appendLine(
            `\n📋 Host picker opened. If "${sshHost}" doesn't appear, you can:`
          );
          outputChannel.appendLine(`   1. Close the picker (Escape)`);
          outputChannel.appendLine(`   2. Try the manual method above`);
          outputChannel.appendLine(
            `   3. Or type "${sshHost}" directly in the picker search box`
          );

          vscode.window
            .showInformationMessage(
              `If "${sshHost}" doesn't appear, try typing it in the search box or use manual method`,
              "Open SSH Config",
              "Reload Window"
            )
            .then((selection) => {
              if (selection === "Open SSH Config") {
                vscode.commands.executeCommand("opensshremotes.openConfigFile");
              } else if (selection === "Reload Window") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
              }
            });
          return;
        } */
      } else {
        // Fallback: try with hostname
        await vscode.commands.executeCommand(connectCommand, sshHost);
      }
    } catch (cmdError: any) {
      // If command fails, try alternative approach for Cursor
      if (remoteSSH_Cursor) {
        outputChannel.appendLine(
          `Command failed, trying alternative approach...`
        );
        // Try opening the Remote-SSH host picker directly
        await vscode.commands.executeCommand("workbench.action.showCommands");
        outputChannel.appendLine(
          `Please type "Remote-SSH: Connect to Host" and select "${sshHost}"`
        );
        vscode.window.showInformationMessage(
          `Please select "${sshHost}" from the Remote-SSH host picker`
        );
        return;
      }
      throw cmdError;
    }

    outputChannel.appendLine(
      "\n✅ All prerequisites verified. Initiating connection..."
    );

    // For Cursor, if we used addNewSshHost, provide additional instructions
    if (remoteSSH_Cursor && connectCommand === "opensshremotes.addNewSshHost") {
      outputChannel.appendLine(
        "\n📝 Note: If a host picker opened, select 'sagemaker' from the list."
      );
      outputChannel.appendLine(
        "   If 'sagemaker' doesn't appear, make sure SSH config is set up correctly."
      );
    }

    vscode.window.showInformationMessage(
      "Connecting to SageMaker via Remote-SSH..."
    );

    // Wait a moment and check if we can verify the connection
    setTimeout(async () => {
      // Check Remote-SSH output for connection status
      outputChannel.appendLine(
        "\n💡 Tip: Check the 'Remote-SSH' output channel for connection details:"
      );
      outputChannel.appendLine(
        "   View → Output → Select 'Remote-SSH' from dropdown"
      );
    }, 2000);
  } catch (error: any) {
    const message = error.message || "Unknown error";
    outputChannel.appendLine(`Error: ${message}`);
    vscode.window.showErrorMessage(`Failed to connect: ${message}`);
  }
}

async function checkConnectionStatus() {
  const outputChannel = vscode.window.createOutputChannel("SageMaker Status");
  outputChannel.show();

  try {
    outputChannel.appendLine("Checking SageMaker connection status...\n");

    // Check prerequisites
    const checks = await checkPrerequisites();

    outputChannel.appendLine("Prerequisites:");

    // AWS CLI
    outputChannel.appendLine(
      `  AWS CLI: ${checks.awsCli ? "✅ Installed" : "❌ Not found"}`
    );
    if (!checks.awsCli) {
      outputChannel.appendLine(
        "    → Install: Download from https://aws.amazon.com/cli/"
      );
      outputChannel.appendLine("    → Or run: winget install Amazon.AWSCLI");
    }

    // Session Manager Plugin
    outputChannel.appendLine(
      `  Session Manager Plugin: ${
        checks.sessionManagerPlugin ? "✅ Installed" : "❌ Not found"
      }`
    );
    if (!checks.sessionManagerPlugin) {
      outputChannel.appendLine(
        '    → Install: code --command "SageMaker: Setup SageMaker Connection"'
      );
      outputChannel.appendLine(
        "    → Or download: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe"
      );
    }

    // Remote-SSH Extension
    const remoteSSH_VSCode = vscode.extensions.getExtension(
      "ms-vscode-remote.remote-ssh"
    );
    const remoteSSH_Cursor = vscode.extensions.getExtension(
      "anysphere.remote-ssh"
    );
    let remoteSSHInfo = "❌ Not found";
    if (checks.remoteSSH) {
      if (remoteSSH_Cursor) {
        remoteSSHInfo = "✅ Installed (anysphere.remote-ssh - Cursor)";
      } else if (remoteSSH_VSCode) {
        remoteSSHInfo = "✅ Installed (ms-vscode-remote.remote-ssh - VS Code)";
      } else {
        remoteSSHInfo = "✅ Installed (unknown version)";
      }
    }

    outputChannel.appendLine(`  Remote-SSH Extension: ${remoteSSHInfo}`);
    if (!checks.remoteSSH) {
      outputChannel.appendLine(
        "    → Install: Remote-SSH extension (ms-vscode-remote.remote-ssh or anysphere.remote-ssh)"
      );
    }

    // SSH Config
    outputChannel.appendLine(
      `  SSH Config: ${
        checks.sshConfig ? "✅ Configured" : "❌ Not configured"
      }`
    );
    if (!checks.sshConfig) {
      outputChannel.appendLine(
        '    → Setup: code --command "SageMaker: Setup SageMaker Connection"'
      );
    }

    // AWS Toolkit
    outputChannel.appendLine(
      `  AWS Toolkit: ${checks.awsToolkit ? "✅ Installed" : "❌ Not found"}`
    );
    if (!checks.awsToolkit) {
      outputChannel.appendLine(
        "    → Install: code --install-extension amazonwebservices.aws-toolkit-vscode"
      );
    }

    if (!checks.allPassed) {
      outputChannel.appendLine("\n❌ Some prerequisites are missing.");
      outputChannel.appendLine(
        'Run "SageMaker: Setup SageMaker Connection" to fix issues.'
      );
    } else {
      outputChannel.appendLine("\n✅ All prerequisites met!");
    }

    // Check if server is running
    const serverInfo = await checkServerStatus();
    if (serverInfo.running) {
      outputChannel.appendLine(
        `\n✅ Local server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
      );
    } else {
      outputChannel.appendLine("\n⚠️  Local server is not running.");
      outputChannel.appendLine(
        'Start it via AWS Toolkit: Right-click Space → "Open Remote Connection"'
      );
    }
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
  }
}

async function setupSageMakerConnection(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("SageMaker Setup");
  outputChannel.show();

  try {
    outputChannel.appendLine("Setting up SageMaker connection...\n");

    // Check and install prerequisites
    const checks = await checkPrerequisites();

    if (!checks.awsCli) {
      outputChannel.appendLine(
        "❌ AWS CLI not found. Please install from: https://aws.amazon.com/cli/"
      );
      vscode.window.showErrorMessage(
        "AWS CLI not found. Please install it first."
      );
      return;
    }

    if (!checks.sessionManagerPlugin) {
      outputChannel.appendLine("Installing Session Manager Plugin...");
      await installSessionManagerPlugin();
      outputChannel.appendLine("✅ Session Manager Plugin installed");
    }

    if (!checks.remoteSSH) {
      outputChannel.appendLine(
        "❌ Remote-SSH extension not found. Please install it from the marketplace."
      );
      outputChannel.appendLine(
        "   Supported extensions: ms-vscode-remote.remote-ssh (VS Code) or anysphere.remote-ssh (Cursor)"
      );
      vscode.window.showErrorMessage(
        "Please install the Remote-SSH extension first (ms-vscode-remote.remote-ssh or anysphere.remote-ssh)."
      );
      return;
    }

    // Setup SSH config
    if (!checks.sshConfig) {
      outputChannel.appendLine("Setting up SSH config...");
      await setupSSHConfig();
      outputChannel.appendLine("✅ SSH config setup complete");
    }

    outputChannel.appendLine("\n✅ Setup complete!");
    vscode.window.showInformationMessage(
      "SageMaker connection setup complete!"
    );
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
  }
}

async function checkPrerequisites(): Promise<{
  allPassed: boolean;
  awsCli: boolean;
  sessionManagerPlugin: boolean;
  remoteSSH: boolean;
  sshConfig: boolean;
  awsToolkit: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check AWS CLI
  let awsCli = false;
  try {
    await execAsync("aws --version");
    awsCli = true;
  } catch {
    errors.push("AWS CLI not found");
  }

  // Check Session Manager Plugin
  let sessionManagerPlugin = false;
  const pluginPath =
    "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin\\session-manager-plugin.exe";
  if (fs.existsSync(pluginPath)) {
    sessionManagerPlugin = true;
  } else {
    try {
      await execAsync("session-manager-plugin --version");
      sessionManagerPlugin = true;
    } catch {
      errors.push("Session Manager Plugin not found");
    }
  }

  // Check Remote-SSH extension (support both VS Code and Cursor versions)
  const remoteSSH_VSCode = vscode.extensions.getExtension(
    "ms-vscode-remote.remote-ssh"
  );
  const remoteSSH_Cursor = vscode.extensions.getExtension(
    "anysphere.remote-ssh"
  );
  const remoteSSH =
    remoteSSH_VSCode !== undefined || remoteSSH_Cursor !== undefined;

  // Determine which extension is installed
  const remoteSSHExtensionId = remoteSSH_Cursor
    ? "anysphere.remote-ssh"
    : remoteSSH_VSCode
    ? "ms-vscode-remote.remote-ssh"
    : null;

  // Check SSH config
  const sshConfigPath = path.join(
    process.env.USERPROFILE || "",
    ".ssh",
    "config"
  );
  let sshConfig = false;
  if (fs.existsSync(sshConfigPath)) {
    const configContent = fs.readFileSync(sshConfigPath, "utf8");
    sshConfig = configContent.includes("Host sagemaker");
  }

  // Check AWS Toolkit
  const awsToolkit =
    vscode.extensions.getExtension("amazonwebservices.aws-toolkit-vscode") !==
    undefined;

  return {
    allPassed: errors.length === 0 && remoteSSH && sshConfig,
    awsCli,
    sessionManagerPlugin,
    remoteSSH,
    sshConfig,
    awsToolkit,
    errors,
  };
}

async function checkServerStatus(): Promise<{
  running: boolean;
  pid?: number;
  port?: number;
  accessible?: boolean;
  error?: string;
}> {
  const serverInfoPath = path.join(
    process.env.APPDATA || "",
    "Cursor",
    "User",
    "globalStorage",
    "amazonwebservices.aws-toolkit-vscode",
    "sagemaker-local-server-info.json"
  );

  try {
    if (fs.existsSync(serverInfoPath)) {
      const info = JSON.parse(fs.readFileSync(serverInfoPath, "utf8"));
      const pid = info.pid;
      const port = info.port;

      // Check if the process is actually running
      let processRunning = false;
      if (pid) {
        try {
          // On Windows, check if process exists
          const { stdout } = await execAsync(
            `tasklist /FI "PID eq ${pid}" 2>&1`
          );
          // tasklist returns the PID in the output if process exists
          // Format: "PID: 12345" or just "12345" in the process list
          processRunning =
            stdout.includes(`${pid}`) && !stdout.includes("INFO: No tasks");
        } catch {
          processRunning = false;
        }
      }

      // Try to verify the server is accessible on the port
      let serverAccessible = false;
      if (port) {
        try {
          // Try to connect to localhost:port to verify server is responding
          const testConnection = await execAsync(
            `powershell -Command "Test-NetConnection -ComputerName localhost -Port ${port} -InformationLevel Quiet" 2>&1`
          );
          serverAccessible =
            testConnection.stdout.includes("True") ||
            testConnection.stdout.trim() === "True";
        } catch {
          // If test fails, assume not accessible
          serverAccessible = false;
        }
      }

      return {
        running: processRunning && serverAccessible,
        pid,
        port,
        accessible: serverAccessible,
        error: !processRunning
          ? "Process not running"
          : !serverAccessible
          ? "Server not accessible on port"
          : undefined,
      };
    }
  } catch (error: any) {
    return { running: false, error: error.message };
  }

  return { running: false, error: "Server info file not found" };
}

async function installSessionManagerPlugin(): Promise<void> {
  const downloadUrl =
    "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe";
  const installerPath = path.join(
    process.env.TEMP || "",
    "SessionManagerPluginSetup.exe"
  );

  // Download and install
  await execAsync(
    `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${installerPath}'"`
  );
  await execAsync(`"${installerPath}" /S`);
}

async function setupSSHConfig(): Promise<void> {
  const sshDir = path.join(process.env.USERPROFILE || "", ".ssh");
  const sshConfigPath = path.join(sshDir, "config");

  // Create .ssh directory if it doesn't exist
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { recursive: true });
  }

  // Read existing config
  let configContent = "";
  if (fs.existsSync(sshConfigPath)) {
    configContent = fs.readFileSync(sshConfigPath, "utf8");
  }

  // Check if sagemaker host already exists
  if (configContent.includes("Host sagemaker")) {
    vscode.window.showInformationMessage(
      "SSH config already contains SageMaker host"
    );
    return;
  }

  // Get configuration
  const spaceArn = await vscode.window.showInputBox({
    prompt: "Enter SageMaker Space ARN",
    placeHolder:
      "arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name",
  });

  if (!spaceArn) {
    throw new Error("Space ARN is required");
  }

  // Generate hostname from ARN
  const hostname = generateHostname(spaceArn);
  const serverInfoPath = path.join(
    process.env.APPDATA || "",
    "Cursor",
    "User",
    "globalStorage",
    "amazonwebservices.aws-toolkit-vscode",
    "sagemaker-local-server-info.json"
  );

  // Add SSH config entry
  // Note: SSH config requires consistent indentation (spaces, not tabs)
  // Using 4 spaces for indentation as per SSH config standards
  const sshEntry = `Host sagemaker
    HostName ${hostname}
    User sagemaker-user
    ForwardAgent yes
    AddKeysToAgent yes
    StrictHostKeyChecking accept-new
    ProxyCommand powershell.exe -NoProfile -Command "$env:SAGEMAKER_LOCAL_SERVER_FILE_PATH='${serverInfoPath}'; & '${path.join(
    process.env.APPDATA || "",
    "Cursor",
    "User",
    "globalStorage",
    "amazonwebservices.aws-toolkit-vscode",
    "sagemaker_connect.ps1"
  )}' %h"
`;

  configContent += sshEntry;
  fs.writeFileSync(sshConfigPath, configContent, "utf8");
}

function generateHostname(arn: string): string {
  // Convert ARN to hostname format: sm_lc_arn_._aws_._sagemaker_._region_._account_._space__domain__space-name
  const parts = arn.split(":");
  const resource = parts[5]; // space/d-xxx/space-name
  const resourceParts = resource.split("/");

  const region = parts[3];
  const account = parts[4];
  const domain = resourceParts[1];
  const spaceName = resourceParts[2];

  return `sm_lc_arn_._aws_._sagemaker_._${region}._${account}_._space__${domain}__${spaceName}`;
}

async function debugSSHConfig() {
  const outputChannel = vscode.window.createOutputChannel(
    "SageMaker SSH Debug"
  );
  outputChannel.show();

  try {
    outputChannel.appendLine("🔍 Debugging SSH Config...\n");

    const sshConfigPath = path.join(
      process.env.USERPROFILE || "",
      ".ssh",
      "config"
    );

    outputChannel.appendLine(`SSH Config Path: ${sshConfigPath}`);
    outputChannel.appendLine(
      `File exists: ${fs.existsSync(sshConfigPath) ? "✅" : "❌"}\n`
    );

    if (!fs.existsSync(sshConfigPath)) {
      outputChannel.appendLine("❌ SSH config file doesn't exist!");
      outputChannel.appendLine("   Run: SageMaker: Setup SageMaker Connection");
      return;
    }

    const configContent = fs.readFileSync(sshConfigPath, "utf8");
    outputChannel.appendLine(`File size: ${configContent.length} bytes`);
    outputChannel.appendLine(
      `Line endings: ${
        configContent.includes("\r\n")
          ? "Windows (CRLF)"
          : configContent.includes("\n")
          ? "Unix (LF)"
          : "Unknown"
      }\n`
    );

    // Check for sagemaker host
    const hasSagemaker = configContent.includes("Host sagemaker");
    outputChannel.appendLine(
      `Contains "Host sagemaker": ${hasSagemaker ? "✅" : "❌"}\n`
    );

    if (hasSagemaker) {
      // Extract the sagemaker section
      const hostMatch = configContent.match(
        new RegExp(`Host sagemaker[\\s\\S]*?(?=Host |$)`, "i")
      );

      if (hostMatch) {
        const hostSection = hostMatch[0];
        outputChannel.appendLine("✅ Found sagemaker host entry:\n");
        outputChannel.appendLine("--- SSH Config Entry ---");
        outputChannel.appendLine(hostSection);
        outputChannel.appendLine("--- End Entry ---\n");

        // Check for common issues
        outputChannel.appendLine("🔍 Checking for common issues:\n");

        // Check indentation (SSH config is sensitive to this)
        const lines = hostSection.split("\n");
        const indentationIssues = lines
          .slice(1)
          .filter(
            (line) =>
              line.trim() && !line.match(/^\s{4,}/) && !line.match(/^Host\s/)
          )
          .map((line, idx) => ({ line: line.trim(), index: idx + 2 }));

        if (indentationIssues.length > 0) {
          outputChannel.appendLine(
            "⚠️  Potential indentation issues (should be 4+ spaces):"
          );
          indentationIssues.forEach(({ line, index }) => {
            outputChannel.appendLine(
              `   Line ${index}: ${line.substring(0, 50)}`
            );
          });
          outputChannel.appendLine("");
        } else {
          outputChannel.appendLine("✅ Indentation looks correct\n");
        }

        // Check for required fields
        const requiredFields = ["HostName", "User", "ProxyCommand"];
        requiredFields.forEach((field) => {
          const hasField = hostSection.includes(field);
          outputChannel.appendLine(`   ${field}: ${hasField ? "✅" : "❌"}`);
        });
        outputChannel.appendLine("");

        // Check ProxyCommand path
        const proxyMatch = hostSection.match(/ProxyCommand\s+(.+)/);
        if (proxyMatch) {
          const proxyCmd = proxyMatch[1];
          outputChannel.appendLine(
            `ProxyCommand: ${proxyCmd.substring(0, 100)}...`
          );

          // Check if PowerShell script path exists
          const scriptPathMatch = proxyCmd.match(/& '([^']+)'/);
          if (scriptPathMatch) {
            const scriptPath = scriptPathMatch[1];
            outputChannel.appendLine(`Script path: ${scriptPath}`);
            outputChannel.appendLine(
              `Script exists: ${fs.existsSync(scriptPath) ? "✅" : "❌"}`
            );
          }
        }
        outputChannel.appendLine("");

        // Try to validate with SSH (if available)
        try {
          outputChannel.appendLine("🔍 Testing SSH config syntax...");
          const { stdout, stderr } = await execAsync(
            `ssh -F "${sshConfigPath}" -G sagemaker 2>&1`
          );
          if (stdout) {
            outputChannel.appendLine("✅ SSH can parse the config:");
            outputChannel.appendLine(stdout);
          }
        } catch (sshError: any) {
          outputChannel.appendLine(`⚠️  SSH validation: ${sshError.message}`);
          outputChannel.appendLine(
            "   (This is normal if SSH isn't in PATH or config has ProxyCommand)"
          );
        }
      } else {
        outputChannel.appendLine(
          "❌ Found 'Host sagemaker' but couldn't extract the entry"
        );
      }
    } else {
      outputChannel.appendLine(
        "❌ SSH config doesn't contain 'Host sagemaker'"
      );
      outputChannel.appendLine("\nCurrent config content:");
      outputChannel.appendLine("---");
      outputChannel.appendLine(configContent.substring(0, 500));
      if (configContent.length > 500) {
        outputChannel.appendLine("... (truncated)");
      }
      outputChannel.appendLine("---");
    }

    outputChannel.appendLine("\n💡 Troubleshooting tips:");
    outputChannel.appendLine(
      "   1. Make sure SSH config uses 4 spaces for indentation"
    );
    outputChannel.appendLine(
      "   2. Check for syntax errors (missing colons, etc.)"
    );
    outputChannel.appendLine(
      "   3. Try opening SSH config: F1 → 'Remote-SSH: Open SSH Configuration File'"
    );
    outputChannel.appendLine("   4. Reload Cursor after making changes");
    outputChannel.appendLine("   5. Check Remote-SSH output for errors");

    vscode.window
      .showInformationMessage(
        "SSH config debug complete. Check output panel for details.",
        "Open SSH Config"
      )
      .then((selection) => {
        if (selection === "Open SSH Config") {
          vscode.commands.executeCommand("opensshremotes.openConfigFile");
        }
      });
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Debug failed: ${error.message}`);
  }
}

async function startLocalServer() {
  const outputChannel = vscode.window.createOutputChannel("SageMaker Server");
  outputChannel.show();

  try {
    outputChannel.appendLine("Attempting to start local server...\n");

    // First check if server is already running
    const serverInfo = await checkServerStatus();
    if (serverInfo.running) {
      outputChannel.appendLine(
        `✅ Server is already running! (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
      );
      vscode.window.showInformationMessage("Local server is already running");
      return;
    }

    outputChannel.appendLine(
      "Server is not running. Trying to trigger AWS Toolkit...\n"
    );

    // Try to execute AWS Toolkit commands that might start the server
    const awsCommands = [
      "aws.sagemaker.connectToNotebookSpace",
      "aws.sagemaker.openNotebook",
      "aws.sagemaker.connectToSpace",
    ];

    let commandFound = false;
    for (const cmd of awsCommands) {
      try {
        const commands = await vscode.commands.getCommands();
        if (commands.includes(cmd)) {
          outputChannel.appendLine(`✅ Found AWS Toolkit command: ${cmd}`);
          outputChannel.appendLine(
            `   Executing command to trigger server start...`
          );
          commandFound = true;

          // Try to execute the command
          // Note: These commands might require user interaction or parameters
          // But executing them might trigger the server to start
          try {
            await vscode.commands.executeCommand(cmd);
            outputChannel.appendLine(
              `   Command executed. Waiting for server to start...`
            );
          } catch (cmdError: any) {
            // Command might fail if it needs parameters, but that's okay
            // The important thing is that it might have triggered server initialization
            outputChannel.appendLine(
              `   Command executed (may have failed, but server might start): ${cmdError.message}`
            );
          }
          break;
        }
      } catch (error: any) {
        // Continue to next command
      }
    }

    if (!commandFound) {
      outputChannel.appendLine(
        "⚠️  Could not find AWS Toolkit commands to trigger server start."
      );
      outputChannel.appendLine("\n💡 Alternative methods to start the server:");
      outputChannel.appendLine("   1. Open AWS Toolkit sidebar (AWS icon)");
      outputChannel.appendLine(
        "   2. Navigate to: SageMaker AI → Studio → Domain → Apps"
      );
      outputChannel.appendLine(
        "   3. Right-click your Space → 'Open Remote Connection'"
      );
      outputChannel.appendLine(
        "   4. Even if connection fails, it might start the server"
      );
    }

    // Wait a bit and check if server started
    outputChannel.appendLine("\n⏳ Waiting 5 seconds for server to start...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const newServerInfo = await checkServerStatus();
    if (newServerInfo.running) {
      outputChannel.appendLine(
        `\n✅ SUCCESS! Server is now running! (PID: ${newServerInfo.pid}, Port: ${newServerInfo.port})`
      );
      vscode.window.showInformationMessage(
        "Local server started successfully!"
      );
    } else {
      outputChannel.appendLine("\n⚠️  Server did not start automatically.");
      outputChannel.appendLine("\n📋 Try these steps:");
      outputChannel.appendLine("   1. Open AWS Toolkit sidebar");
      outputChannel.appendLine(
        "   2. Right-click your SageMaker Space → 'Open Remote Connection'"
      );
      outputChannel.appendLine(
        "   3. Check Output panel (Ctrl+Shift+U) → 'AWS Toolkit' for errors"
      );
      outputChannel.appendLine(
        "   4. Look for 'code --folder-uri' errors (indicates wrapper issue)"
      );

      // Check for code wrapper issue
      const codeWrapperIssue = await checkCodeWrapperIssue();
      if (codeWrapperIssue.hasIssue) {
        outputChannel.appendLine("\n⚠️  CODE WRAPPER ISSUE DETECTED!");
        outputChannel.appendLine(`   ${codeWrapperIssue.message}`);
        outputChannel.appendLine(
          "\n💡 This is likely preventing the server from starting."
        );
        outputChannel.appendLine(
          "   Fix it by running: .\\scripts\\fix_cursor_code_command.ps1"
        );

        const fixAction = await vscode.window.showWarningMessage(
          "Code wrapper issue detected. This might prevent server from starting. Fix it now?",
          "Fix Code Wrapper",
          "Check Status"
        );

        if (fixAction === "Fix Code Wrapper") {
          // Open terminal and run the fix script
          const terminal = vscode.window.createTerminal("Fix Code Wrapper");
          // Try to find the script relative to workspace or use absolute path
          const workspaceFolders = vscode.workspace.workspaceFolders;
          let scriptPath = "";
          if (workspaceFolders && workspaceFolders.length > 0) {
            scriptPath = path.join(
              workspaceFolders[0].uri.fsPath,
              "scripts",
              "fix_cursor_code_command.ps1"
            );
          } else {
            // Fallback to hardcoded path
            scriptPath = path.join(
              process.env.USERPROFILE || "",
              "OneDrive - Georgia Institute of Technology",
              "Projects",
              "Dream_Flow_Flutter_App",
              "dream_flow",
              "notebooks",
              "scripts",
              "fix_cursor_code_command.ps1"
            );
          }
          terminal.sendText(
            `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
          );
          terminal.show();
        } else if (fixAction === "Check Status") {
          vscode.commands.executeCommand("sagemaker-remote.checkStatus");
        }
      }
    }
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Failed to start server: ${error.message}`);
  }
}

async function checkCodeWrapperIssue(): Promise<{
  hasIssue: boolean;
  message: string;
}> {
  try {
    // Check if code command exists
    try {
      const { stdout } = await execAsync("where code 2>&1");
      const codePath = stdout.trim().split("\n")[0];

      if (
        !codePath ||
        codePath.includes("not found") ||
        codePath.includes("Could not find")
      ) {
        return {
          hasIssue: true,
          message:
            "Code command not found in PATH. AWS Toolkit can't start the server.",
        };
      }

      // Check if it points to Cursor or VS Code
      if (codePath.toLowerCase().includes("cursor")) {
        // Good - points to Cursor
        // Test if it handles --folder-uri correctly
        try {
          // This will fail, but we want to see the error
          await execAsync('code --folder-uri "vscode-remote://test" 2>&1');
        } catch (testError: any) {
          const errorMsg = testError.message || testError.stderr || "";
          if (
            errorMsg.includes("bad option") ||
            errorMsg.includes("--folder-uri")
          ) {
            return {
              hasIssue: true,
              message:
                "Code wrapper doesn't handle --folder-uri flag correctly. Cursor doesn't support this flag.",
            };
          }
        }

        return {
          hasIssue: false,
          message: "Code wrapper appears to be working correctly.",
        };
      } else if (
        codePath.toLowerCase().includes("code.exe") ||
        codePath.toLowerCase().includes("vs code")
      ) {
        return {
          hasIssue: true,
          message:
            "Code command points to VS Code instead of Cursor. AWS Toolkit will open VS Code instead of Cursor.",
        };
      }
    } catch {
      return {
        hasIssue: true,
        message:
          "Could not verify code command. It may not be in PATH or configured correctly.",
      };
    }

    return {
      hasIssue: false,
      message: "Code wrapper appears to be configured correctly.",
    };
  } catch (error: any) {
    return {
      hasIssue: false,
      message: `Could not check code wrapper: ${error.message}`,
    };
  }
}

async function diagnoseConnection() {
  const outputChannel = vscode.window.createOutputChannel(
    "SageMaker Diagnostics"
  );
  outputChannel.show();

  try {
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("SageMaker Connection Diagnostics");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");

    // 1. Check code wrapper
    outputChannel.appendLine("1. Checking code wrapper...");
    const codeWrapperIssue = await checkCodeWrapperIssue();
    if (codeWrapperIssue.hasIssue) {
      outputChannel.appendLine(`   ❌ ${codeWrapperIssue.message}`);
    } else {
      outputChannel.appendLine(`   ✅ ${codeWrapperIssue.message}`);
    }
    outputChannel.appendLine("");

    // 2. Check PATH configuration
    outputChannel.appendLine("2. Checking PATH configuration...");
    try {
      const { stdout } = await execAsync(
        "powershell -Command \"$env:Path -split ';' | Select-String -Pattern '$env:USERPROFILE'\""
      );
      if (stdout.trim()) {
        outputChannel.appendLine("   ✅ User profile is in PATH");
        // Check if it's at the start
        const { stdout: pathCheck } = await execAsync(
          "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pathParts = $userPath -split ';'; if ($pathParts[0] -eq $env:USERPROFILE) { Write-Output 'START' } else { Write-Output 'NOT_START' }\""
        );
        if (pathCheck.trim() === "START") {
          outputChannel.appendLine("   ✅ User profile is at START of PATH");
        } else {
          outputChannel.appendLine(
            "   ⚠️  User profile is in PATH but not at the start"
          );
        }
      } else {
        outputChannel.appendLine("   ❌ User profile NOT in PATH");
      }
    } catch {
      outputChannel.appendLine("   ⚠️  Could not check PATH");
    }
    outputChannel.appendLine("");

    // 3. Check which 'code' command is found
    outputChannel.appendLine("3. Checking which 'code' command is found...");
    try {
      const { stdout } = await execAsync("where code 2>&1");
      const codePath = stdout.trim().split("\n")[0];
      if (codePath && !codePath.includes("not found")) {
        outputChannel.appendLine(`   ✅ Found: ${codePath}`);
        if (codePath.includes(process.env.USERPROFILE || "")) {
          outputChannel.appendLine("   ✅ Using wrapper from user profile");
        } else if (codePath.toLowerCase().includes("cursor")) {
          outputChannel.appendLine("   ✅ Points to Cursor");
        } else if (
          codePath.toLowerCase().includes("code.exe") ||
          codePath.toLowerCase().includes("vs code")
        ) {
          outputChannel.appendLine("   ❌ Using VS Code instead of wrapper!");
        }
      } else {
        outputChannel.appendLine("   ❌ 'code' command not found in PATH");
      }
    } catch {
      outputChannel.appendLine("   ❌ Could not find 'code' command");
    }
    outputChannel.appendLine("");

    // 4. Check Cursor installation
    outputChannel.appendLine("4. Checking Cursor installation...");
    const cursorExe = path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "cursor",
      "Cursor.exe"
    );
    if (fs.existsSync(cursorExe)) {
      const stats = fs.statSync(cursorExe);
      outputChannel.appendLine(`   ✅ Cursor found at: ${cursorExe}`);
    } else {
      outputChannel.appendLine("   ⚠️  Cursor not found at expected location");
    }
    outputChannel.appendLine("");

    // 5. Check Remote-SSH extension
    outputChannel.appendLine("5. Remote-SSH Extension Check...");
    const remoteSSH_VSCode = vscode.extensions.getExtension(
      "ms-vscode-remote.remote-ssh"
    );
    const remoteSSH_Cursor = vscode.extensions.getExtension(
      "anysphere.remote-ssh"
    );
    if (remoteSSH_Cursor || remoteSSH_VSCode) {
      outputChannel.appendLine("   ✅ Remote-SSH extension is installed");
      if (remoteSSH_Cursor) {
        outputChannel.appendLine(
          "      Version: anysphere.remote-ssh (Cursor)"
        );
      } else {
        outputChannel.appendLine(
          "      Version: ms-vscode-remote.remote-ssh (VS Code)"
        );
      }
    } else {
      outputChannel.appendLine("   ❌ Remote-SSH extension NOT installed");
      outputChannel.appendLine(
        "      This extension is REQUIRED for remote connections!"
      );
    }
    outputChannel.appendLine("");

    // 6. Check SSH config
    outputChannel.appendLine("6. Checking SSH config...");
    const sshConfigPath = path.join(
      process.env.USERPROFILE || "",
      ".ssh",
      "config"
    );
    if (fs.existsSync(sshConfigPath)) {
      outputChannel.appendLine("   ✅ SSH config exists");
      const content = fs.readFileSync(sshConfigPath, "utf8");
      if (content.includes("sm_") || content.includes("sagemaker")) {
        outputChannel.appendLine("   ✅ Found SageMaker SSH entries");
      } else {
        outputChannel.appendLine("   ⚠️  No SageMaker SSH entries found");
        outputChannel.appendLine(
          "      AWS Toolkit will create these when connecting"
        );
      }
    } else {
      outputChannel.appendLine(
        "   ⚠️  SSH config not found (will be created automatically)"
      );
    }
    outputChannel.appendLine("");

    // 7. Check server status
    outputChannel.appendLine("7. Checking local server status...");
    const serverInfo = await checkServerStatus();
    if (serverInfo.running) {
      outputChannel.appendLine(
        `   ✅ Server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
      );
    } else {
      outputChannel.appendLine("   ❌ Server is NOT running");
      if (serverInfo.error) {
        outputChannel.appendLine(`      Error: ${serverInfo.error}`);
      }
    }
    outputChannel.appendLine("");

    // 8. Check ARN conversion fix
    outputChannel.appendLine("8. Checking ARN conversion fix...");
    const connectScriptPath = path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "amazonwebservices.aws-toolkit-vscode",
      "sagemaker_connect.ps1"
    );
    if (fs.existsSync(connectScriptPath)) {
      const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
      if (scriptContent.includes("Convert app ARN to space ARN")) {
        outputChannel.appendLine("   ✅ ARN conversion fix is applied");
      } else {
        outputChannel.appendLine("   ❌ ARN conversion fix NOT applied");
        outputChannel.appendLine("      Run: SageMaker: Fix ARN Conversion");
      }
    } else {
      outputChannel.appendLine(
        "   ⚠️  Connection script not found (server hasn't started yet)"
      );
    }
    outputChannel.appendLine("");

    // 9. Check mapping file
    outputChannel.appendLine("9. Checking profile mapping file...");
    const mappingFile = path.join(
      process.env.USERPROFILE || "",
      ".aws",
      ".sagemaker-space-profiles"
    );
    if (fs.existsSync(mappingFile)) {
      outputChannel.appendLine("   ✅ Mapping file exists");
      try {
        const mappingContent = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
        const spaceArns = Object.keys(mappingContent.localCredential || {});
        outputChannel.appendLine(`      Found ${spaceArns.length} profile(s)`);
      } catch {
        outputChannel.appendLine(
          "   ⚠️  Mapping file exists but could not parse"
        );
      }
    } else {
      outputChannel.appendLine(
        "   ⚠️  Mapping file not found (will be created when server starts)"
      );
    }
    outputChannel.appendLine("");

    outputChannel.appendLine("========================================");
    outputChannel.appendLine("Diagnostics Complete");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");

    // Recommendations
    outputChannel.appendLine("Recommendations:");
    if (codeWrapperIssue.hasIssue) {
      outputChannel.appendLine(
        "1. Fix code wrapper: SageMaker: Fix Code Wrapper"
      );
    }
    if (!serverInfo.running) {
      outputChannel.appendLine(
        "2. Start server: SageMaker: Start Local Server"
      );
    }
    if (fs.existsSync(connectScriptPath)) {
      const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
      if (!scriptContent.includes("Convert app ARN to space ARN")) {
        outputChannel.appendLine(
          "3. Apply ARN conversion fix: SageMaker: Fix ARN Conversion"
        );
      }
    }
    outputChannel.appendLine(
      "4. Or apply all fixes: SageMaker: Apply All Fixes"
    );

    vscode.window
      .showInformationMessage(
        "Diagnostics complete. Check output panel for details.",
        "Apply All Fixes",
        "Fix Issues"
      )
      .then((selection) => {
        if (selection === "Apply All Fixes") {
          vscode.commands.executeCommand("sagemaker-remote.applyAllFixes");
        } else if (selection === "Fix Issues") {
          vscode.window
            .showQuickPick([
              "Fix Code Wrapper",
              "Fix ARN Conversion",
              "Fix SSH Config",
              "Start Server",
            ])
            .then((choice) => {
              if (choice === "Fix Code Wrapper") {
                vscode.commands.executeCommand(
                  "sagemaker-remote.fixCodeWrapper"
                );
              } else if (choice === "Fix ARN Conversion") {
                vscode.commands.executeCommand(
                  "sagemaker-remote.fixArnConversion"
                );
              } else if (choice === "Fix SSH Config") {
                vscode.commands.executeCommand("sagemaker-remote.fixSshConfig");
              } else if (choice === "Start Server") {
                vscode.commands.executeCommand("sagemaker-remote.startServer");
              }
            });
        }
      });
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Diagnostics failed: ${error.message}`);
  }
}

async function fixArnConversion() {
  const outputChannel = vscode.window.createOutputChannel("Fix ARN Conversion");
  outputChannel.show();

  try {
    outputChannel.appendLine(
      "Fixing ARN conversion in sagemaker_connect.ps1...\n"
    );

    const connectScriptPath = path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "amazonwebservices.aws-toolkit-vscode",
      "sagemaker_connect.ps1"
    );

    if (!fs.existsSync(connectScriptPath)) {
      outputChannel.appendLine("❌ Connection script not found!");
      outputChannel.appendLine(
        "   The script is created by AWS Toolkit when the server starts."
      );
      outputChannel.appendLine(
        "   Please start the server first: SageMaker: Start Local Server"
      );
      vscode.window.showErrorMessage(
        "Connection script not found. Start the server first."
      );
      return;
    }

    // Read script
    let scriptContent = fs.readFileSync(connectScriptPath, "utf8");

    // Check if fix already applied
    if (scriptContent.includes("Convert app ARN to space ARN")) {
      outputChannel.appendLine("✅ Fix already applied!");
      vscode.window.showInformationMessage(
        "ARN conversion fix is already applied."
      );
      return;
    }

    // Create backup
    const backupPath = `${connectScriptPath}.backup.${Date.now()}`;
    fs.copyFileSync(connectScriptPath, backupPath);
    outputChannel.appendLine(`✅ Created backup: ${backupPath}`);

    // Find insertion point (after ARN parsing)
    // Build PowerShell code as string to avoid TypeScript template parsing
    const arnConversionCode = [
      "",
      "# Convert app ARN to space ARN if needed (server only accepts space ARNs)",
      "if ($AWS_RESOURCE_ARN -match '^arn:aws:sagemaker:([^:]+):(\\d+):app/([^/]+)/([^/]+)/.*$') {",
      "    $region = $matches[1]",
      "    $account = $matches[2]",
      "    $domain = $matches[3]",
      "    $space = $matches[4]",
      '    $AWS_RESOURCE_ARN = "arn:aws:sagemaker:" + $region + ":" + $account + ":space/" + $domain + "/" + $space',
      '    Write-Host "Converted app ARN to space ARN: $AWS_RESOURCE_ARN"',
      "}",
      "",
    ].join("\n");

    // Find the line where AWS_RESOURCE_ARN is set
    const arnPattern =
      /(\$AWS_RESOURCE_ARN = \$matches\[2\] -replace '_\._', ':' -replace '__', '\/'\s*\n)/;

    if (scriptContent.match(arnPattern)) {
      scriptContent = scriptContent.replace(
        arnPattern,
        `$1${arnConversionCode}`
      );
      fs.writeFileSync(connectScriptPath, scriptContent, "utf8");
      outputChannel.appendLine("✅ Added ARN conversion logic!");
      outputChannel.appendLine(
        "   The script will now convert app ARNs to space ARNs automatically"
      );
      vscode.window.showInformationMessage(
        "ARN conversion fix applied successfully!"
      );
    } else {
      outputChannel.appendLine("❌ Could not find insertion point in script");
      outputChannel.appendLine("   The script format may have changed");
      vscode.window.showErrorMessage(
        "Could not apply fix. Script format may have changed."
      );
    }
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
  }
}

async function fixCodeWrapper() {
  const outputChannel = vscode.window.createOutputChannel("Fix Code Wrapper");
  outputChannel.show();

  try {
    outputChannel.appendLine("Fixing code wrapper...\n");

    // Find the fix script
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let scriptPath = "";

    if (workspaceFolders && workspaceFolders.length > 0) {
      scriptPath = path.join(
        workspaceFolders[0].uri.fsPath,
        "scripts",
        "fix_cursor_code_command.ps1"
      );
    } else {
      // Try common locations
      const possiblePaths = [
        path.join(
          process.env.USERPROFILE || "",
          "OneDrive - Georgia Institute of Technology",
          "Projects",
          "Dream_Flow_Flutter_App",
          "dream_flow",
          "notebooks",
          "scripts",
          "fix_cursor_code_command.ps1"
        ),
        path.join(process.env.USERPROFILE || "", "code.cmd"),
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          scriptPath = possiblePath;
          break;
        }
      }
    }

    if (!scriptPath || !fs.existsSync(scriptPath)) {
      outputChannel.appendLine("❌ Fix script not found!");
      outputChannel.appendLine("   Creating code wrapper manually...");

      // Create code wrapper manually
      const codeWrapperPath = path.join(
        process.env.USERPROFILE || "",
        "code.cmd"
      );
      const cursorExe = path.join(
        process.env.LOCALAPPDATA || "",
        "Programs",
        "cursor",
        "Cursor.exe"
      );
      const codeWrapperContent = `@echo off
setlocal

set "FOLDER_URI="
set "NEXT_IS_URI=0"

:parse_args
if "%~1"=="" goto execute
if "%NEXT_IS_URI%"=="1" (
    set "FOLDER_URI=%~1"
    set "NEXT_IS_URI=0"
    shift
    goto parse_args
)
if /i "%~1"=="--folder-uri" (
    set "NEXT_IS_URI=1"
    shift
    goto parse_args
)
set "ARGS=%ARGS% %~1"
shift
goto parse_args

:execute
if defined FOLDER_URI (
    "${cursorExe.replace(/\\/g, "\\\\")}" %FOLDER_URI%
) else (
    "${cursorExe.replace(/\\/g, "\\\\")}" %ARGS%
)
`;

      fs.writeFileSync(codeWrapperPath, codeWrapperContent, "utf8");
      outputChannel.appendLine(
        `✅ Created code wrapper at: ${codeWrapperPath}`
      );

      // Add to PATH if not already there
      outputChannel.appendLine("   Checking PATH...");
      try {
        const { stdout } = await execAsync(
          "powershell -Command \"$env:Path -split ';' | Select-String -Pattern '$env:USERPROFILE'\""
        );
        if (!stdout.trim()) {
          outputChannel.appendLine(
            "   ⚠️  User profile not in PATH. Adding..."
          );
          await execAsync(
            `powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + '$env:USERPROFILE', 'User')"`
          );
          outputChannel.appendLine("   ✅ Added to PATH");
          outputChannel.appendLine(
            "   ⚠️  You may need to restart Cursor for PATH changes to take effect"
          );
        } else {
          outputChannel.appendLine("   ✅ User profile already in PATH");
        }
      } catch {
        outputChannel.appendLine("   ⚠️  Could not modify PATH automatically");
        outputChannel.appendLine(
          "   Please add %USERPROFILE% to your PATH manually"
        );
      }

      vscode.window.showInformationMessage(
        "Code wrapper created! You may need to restart Cursor."
      );
    } else {
      // Run the fix script
      outputChannel.appendLine(`Running fix script: ${scriptPath}`);
      const terminal = vscode.window.createTerminal("Fix Code Wrapper");
      terminal.sendText(
        `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      );
      terminal.show();
      vscode.window.showInformationMessage(
        "Running code wrapper fix script. Check terminal for output."
      );
    }
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
  }
}

async function fixSshConfig() {
  const outputChannel = vscode.window.createOutputChannel("Fix SSH Config");
  outputChannel.show();

  try {
    outputChannel.appendLine("Fixing SSH config...\n");

    const sshConfigPath = path.join(
      process.env.USERPROFILE || "",
      ".ssh",
      "config"
    );

    if (!fs.existsSync(sshConfigPath)) {
      outputChannel.appendLine("❌ SSH config file not found!");
      outputChannel.appendLine("   Run: SageMaker: Setup SageMaker Connection");
      vscode.window.showErrorMessage(
        "SSH config not found. Run Setup command first."
      );
      return;
    }

    let configContent = fs.readFileSync(sshConfigPath, "utf8");

    // Check if sagemaker host exists
    if (!configContent.includes("Host sagemaker")) {
      outputChannel.appendLine(
        "❌ SSH config doesn't contain 'Host sagemaker'"
      );
      outputChannel.appendLine("   Run: SageMaker: Setup SageMaker Connection");
      vscode.window.showErrorMessage(
        "SSH config missing. Run Setup command first."
      );
      return;
    }

    // Extract sagemaker host section
    const hostMatch = configContent.match(/Host sagemaker[\s\S]*?(?=Host |$)/i);
    if (!hostMatch) {
      outputChannel.appendLine("❌ Could not find sagemaker host entry");
      return;
    }

    const hostSection = hostMatch[0];
    let needsFix = false;
    let fixedSection = hostSection;

    // Fix 1: Check ProxyCommand uses %h instead of %n
    if (hostSection.includes("%n") && !hostSection.includes("%h")) {
      outputChannel.appendLine(
        "⚠️  Found issue: ProxyCommand uses %n instead of %h"
      );
      fixedSection = fixedSection.replace(/%n/g, "%h");
      needsFix = true;
    }

    // Fix 2: Check environment variable is set
    const serverInfoPath = path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "amazonwebservices.aws-toolkit-vscode",
      "sagemaker-local-server-info.json"
    );

    if (!hostSection.includes("SAGEMAKER_LOCAL_SERVER_FILE_PATH")) {
      outputChannel.appendLine(
        "⚠️  Found issue: Missing SAGEMAKER_LOCAL_SERVER_FILE_PATH"
      );
      // Add environment variable to ProxyCommand
      fixedSection = fixedSection.replace(
        /(ProxyCommand\s+)(.+)/,
        `$1powershell.exe -NoProfile -Command "$env:SAGEMAKER_LOCAL_SERVER_FILE_PATH='${serverInfoPath}'; & '$2' %h"`
      );
      needsFix = true;
    }

    if (needsFix) {
      // Create backup
      const backupPath = `${sshConfigPath}.backup.${Date.now()}`;
      fs.copyFileSync(sshConfigPath, backupPath);
      outputChannel.appendLine(`✅ Created backup: ${backupPath}`);

      // Replace the section
      configContent = configContent.replace(
        /Host sagemaker[\s\S]*?(?=Host |$)/i,
        fixedSection
      );
      fs.writeFileSync(sshConfigPath, configContent, "utf8");

      outputChannel.appendLine("✅ SSH config fixed!");
      vscode.window.showInformationMessage("SSH config fixed successfully!");
    } else {
      outputChannel.appendLine("✅ SSH config looks good - no fixes needed");
      vscode.window.showInformationMessage("SSH config is already correct.");
    }
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
  }
}

async function applyAllFixes() {
  const outputChannel = vscode.window.createOutputChannel("Apply All Fixes");
  outputChannel.show();

  try {
    outputChannel.appendLine("Applying all fixes...\n");
    outputChannel.appendLine("This will:");
    outputChannel.appendLine("1. Fix code wrapper");
    outputChannel.appendLine("2. Fix ARN conversion");
    outputChannel.appendLine("3. Fix SSH config");
    outputChannel.appendLine("");

    const result = await vscode.window.showWarningMessage(
      "Apply all fixes? This will modify your configuration files.",
      "Apply All",
      "Cancel"
    );

    if (result !== "Apply All") {
      outputChannel.appendLine("Cancelled by user");
      return;
    }

    // 1. Fix code wrapper
    outputChannel.appendLine("1. Fixing code wrapper...");
    await fixCodeWrapper();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Fix ARN conversion
    outputChannel.appendLine("\n2. Fixing ARN conversion...");
    await fixArnConversion();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Fix SSH config
    outputChannel.appendLine("\n3. Fixing SSH config...");
    await fixSshConfig();

    outputChannel.appendLine("\n========================================");
    outputChannel.appendLine("✅ All fixes applied!");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");
    outputChannel.appendLine("Next steps:");
    outputChannel.appendLine("1. Restart Cursor (if code wrapper was fixed)");
    outputChannel.appendLine("2. Start server: SageMaker: Start Local Server");
    outputChannel.appendLine("3. Connect: SageMaker: Connect to SageMaker");

    vscode.window
      .showInformationMessage(
        "All fixes applied! You may need to restart Cursor.",
        "Restart Cursor",
        "Start Server"
      )
      .then((selection) => {
        if (selection === "Restart Cursor") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        } else if (selection === "Start Server") {
          vscode.commands.executeCommand("sagemaker-remote.startServer");
        }
      });
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Failed to apply fixes: ${error.message}`);
  }
}

/**
 * Quick Start: Automates the entire SageMaker connection process
 * This command does everything needed to connect to SageMaker in one go
 */
async function quickStartSageMaker(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
  outputChannel.show();
  outputChannel.appendLine("========================================");
  outputChannel.appendLine("🚀 Quick Start: SageMaker Connection");
  outputChannel.appendLine("========================================");
  outputChannel.appendLine("");

  try {
    // Step 1: Check prerequisites
    outputChannel.appendLine("Step 1: Checking prerequisites...");
    const checks = await checkPrerequisites();
    if (!checks.allPassed) {
      outputChannel.appendLine(`❌ Prerequisites not met: ${checks.errors.join(", ")}`);
      vscode.window.showErrorMessage(
        `Prerequisites not met: ${checks.errors.join(", ")}`
      );
      return;
    }
    outputChannel.appendLine("✅ Prerequisites check passed");

    // Step 2: Fix ARN conversion (ensure script handles ARN correctly)
    outputChannel.appendLine("\nStep 2: Ensuring ARN conversion is correct...");
    try {
      await fixArnConversion();
      outputChannel.appendLine("✅ ARN conversion verified/fixed");
    } catch (error: any) {
      outputChannel.appendLine(`⚠️  ARN conversion check: ${error.message}`);
      // Continue anyway - might already be fixed
    }

    // Step 3: Remove old SSH host keys (fix host key verification issues)
    outputChannel.appendLine("\nStep 3: Cleaning up old SSH host keys...");
    try {
      const knownHostsPath = path.join(
        process.env.USERPROFILE || "",
        ".ssh",
        "known_hosts"
      );
      if (fs.existsSync(knownHostsPath)) {
        const content = fs.readFileSync(knownHostsPath, "utf8");
        const lines = content.split("\n");
        const filtered = lines.filter((line) => !line.includes("sm_lc_arn"));
        if (filtered.length < lines.length) {
          fs.writeFileSync(knownHostsPath, filtered.join("\n"));
          outputChannel.appendLine("✅ Removed old host keys");
        } else {
          outputChannel.appendLine("✅ No old host keys found");
        }
      } else {
        outputChannel.appendLine("✅ No known_hosts file (will be created on first connection)");
      }
    } catch (error: any) {
      outputChannel.appendLine(`⚠️  Host key cleanup: ${error.message}`);
      // Continue anyway
    }

    // Step 4: Check server status
    outputChannel.appendLine("\nStep 4: Checking local server status...");
    const serverInfo = await checkServerStatus();

    if (!serverInfo.running || !serverInfo.accessible) {
      outputChannel.appendLine("\n❌ Server is NOT running");
      outputChannel.appendLine("\n📋 To start the server:");
      outputChannel.appendLine("   1. Open AWS Toolkit sidebar (AWS icon in left sidebar)");
      outputChannel.appendLine("   2. Navigate to: SageMaker AI → Studio → Domain → SPACES");
      outputChannel.appendLine("   3. Right-click on your SPACE (NOT the app)");
      outputChannel.appendLine("   4. Click: 'Open Remote Connection'");
      outputChannel.appendLine("   5. Wait 10-15 seconds for server to start");
      outputChannel.appendLine("\n   Then run this command again to connect.");

      const action = await vscode.window.showWarningMessage(
        "Server is not running. Start it via AWS Toolkit, then run this command again.",
        "Open AWS Toolkit",
        "Check Status",
        "I'll Start It Manually"
      );

      if (action === "Open AWS Toolkit") {
        await vscode.commands.executeCommand("workbench.view.extension.aws-toolkit");
      } else if (action === "Check Status") {
        vscode.commands.executeCommand("sagemaker-remote.checkStatus");
      }

      return;
    }

    outputChannel.appendLine(
      `✅ Server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
    );

    // Step 5: Final verification before connecting
    outputChannel.appendLine("\nStep 5: Final verification...");
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause
    const finalCheck = await checkServerStatus();
    if (!finalCheck.running || !finalCheck.accessible) {
      outputChannel.appendLine("❌ Server stopped between checks!");
      outputChannel.appendLine("Please restart the server and try again.");
      vscode.window.showErrorMessage(
        "Server stopped. Please restart it via AWS Toolkit and try again."
      );
      return;
    }
    outputChannel.appendLine("✅ Server verified and ready");

    // Step 6: Connect via Remote-SSH
    outputChannel.appendLine("\nStep 6: Connecting via Remote-SSH...");
    const config = vscode.workspace.getConfiguration("sagemakerRemote");
    const sshHost = config.get<string>("sshHostAlias", "sagemaker");

    outputChannel.appendLine(`Using SSH host: ${sshHost}`);
    outputChannel.appendLine("Initiating Remote-SSH connection...");

    // Use Remote-SSH extension to connect
    try {
      await vscode.commands.executeCommand("opensshremotes.addNewSshHost", sshHost);
      outputChannel.appendLine("✅ Connection initiated!");
      outputChannel.appendLine("\nThe Remote-SSH window should open shortly.");
      outputChannel.appendLine("If prompted, select the SSH host from the list.");
    } catch (error: any) {
      // Fallback: try the standard Remote-SSH connect command
      outputChannel.appendLine("Trying alternative connection method...");
      try {
        await vscode.commands.executeCommand("remote-ssh.connectToHost", sshHost);
        outputChannel.appendLine("✅ Connection initiated!");
      } catch (error2: any) {
        outputChannel.appendLine(`❌ Failed to initiate connection: ${error2.message}`);
        outputChannel.appendLine("\n💡 Manual connection:");
        outputChannel.appendLine(`   1. Press F1`);
        outputChannel.appendLine(`   2. Type: Remote-SSH: Connect to Host`);
        outputChannel.appendLine(`   3. Enter: ${sshHost}`);
        vscode.window.showErrorMessage(
          "Failed to auto-connect. Please connect manually via Remote-SSH."
        );
      }
    }

    outputChannel.appendLine("\n========================================");
    outputChannel.appendLine("✅ Quick Start Complete!");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("\nThe connection should be establishing now.");
    outputChannel.appendLine("If the Remote-SSH window doesn't open, connect manually:");
    outputChannel.appendLine(`  F1 → Remote-SSH: Connect to Host → ${sshHost}`);
  } catch (error: any) {
    outputChannel.appendLine(`\n❌ Error during quick start: ${error.message}`);
    vscode.window.showErrorMessage(`Quick start failed: ${error.message}`);
  }
}

export function deactivate() {}
