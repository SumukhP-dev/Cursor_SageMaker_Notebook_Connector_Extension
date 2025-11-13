/**
 * Service for managing SageMaker connections via Remote-SSH
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { ServerManager } from "./ServerManager";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";
import { SSHConfigManager } from "./SSHConfigManager";

export class ConnectionManager {
  /**
   * Connect to SageMaker via Remote-SSH
   */
  static async connectToSageMaker(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
    outputChannel.show();

    try {
      outputChannel.appendLine("Connecting to SageMaker...");

      // Check prerequisites
      const checks = await PrerequisitesChecker.checkAll();
      if (!checks.allPassed) {
        vscode.window.showErrorMessage(
          `Prerequisites not met: ${checks.errors.join(", ")}`
        );
        return;
      }

      // CRITICAL: Check local server BEFORE attempting connection
      outputChannel.appendLine("\n🔍 Checking local server status...");
      const serverInfo = await ServerManager.checkServerStatus();

      if (!serverInfo.running) {
        await this.handleServerNotRunning(outputChannel);
        return;
      }

      // Verify server is accessible
      if (serverInfo.accessible === false || !serverInfo.running) {
        await this.handleServerNotAccessible(outputChannel, serverInfo);
        return;
      }

      outputChannel.appendLine(
        `✅ Local server is running and accessible (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
      );

      // Final verification before connecting
      outputChannel.appendLine("\n🔍 Final verification: Checking server is still running...");
      const finalCheck = await ServerManager.checkServerStatus();
      if (!finalCheck.running || !finalCheck.accessible) {
        await this.handleServerStopped(outputChannel);
        return;
      }

      outputChannel.appendLine("✅ Server verified - still running and accessible");

      // Verify PowerShell script exists
      if (!ServerManager.connectionScriptExists()) {
        await this.handleScriptNotFound(outputChannel);
        return;
      }

      outputChannel.appendLine(
        `✅ PowerShell script found: ${ServerManager.getConnectionScriptPath()}`
      );

      // Get SSH host alias from config
      const config = vscode.workspace.getConfiguration("sagemakerRemote");
      const sshHost = config.get<string>("sshHostAlias", "sagemaker");

      outputChannel.appendLine(`\nUsing SSH host: ${sshHost}`);

      // Verify Remote-SSH extension
      if (!checks.remoteSSH) {
        const errorMsg = "Remote-SSH extension not found. Please install it first.";
        outputChannel.appendLine(`❌ ${errorMsg}`);
        outputChannel.appendLine(
          "   Install: ms-vscode-remote.remote-ssh (VS Code) or anysphere.remote-ssh (Cursor)"
        );
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      // Detect Remote-SSH extension and connect
      const remoteSSH = await PrerequisitesChecker.checkRemoteSSHExtension();
      await this.initiateConnection(outputChannel, sshHost, remoteSSH);
    } catch (error: any) {
      const message = error.message || "Unknown error";
      const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
      outputChannel.appendLine(`Error: ${message}`);
      vscode.window.showErrorMessage(`Failed to connect: ${message}`);
    }
  }

  /**
   * Handle case when server is not running
   */
  private static async handleServerNotRunning(
    outputChannel: vscode.OutputChannel
  ): Promise<void> {
    outputChannel.appendLine("\n❌ ERROR: Local server is NOT running!");
    outputChannel.appendLine(
      "   The connection will FAIL. You MUST start the server first."
    );

    // Check for code wrapper issue
    outputChannel.appendLine("\n🔍 Diagnosing server start issue...");
    const codeWrapperIssue = await CodeWrapperChecker.checkCodeWrapperIssue();
    if (codeWrapperIssue.hasIssue) {
      outputChannel.appendLine("\n⚠️  FOUND ISSUE: Code wrapper problem detected!");
      outputChannel.appendLine(`   ${codeWrapperIssue.message}`);
      outputChannel.appendLine(
        "\n💡 This is likely preventing AWS Toolkit from starting the server."
      );
      outputChannel.appendLine(
        "   AWS Toolkit tries to use 'code --folder-uri' which Cursor doesn't support."
      );
      outputChannel.appendLine("\n📋 Fix the code wrapper:");
      outputChannel.appendLine("   1. Run: .\\scripts\\fix_cursor_code_command.ps1");
      outputChannel.appendLine("   2. Restart Cursor completely");
      outputChannel.appendLine("   3. Try starting the server again");
    }

    outputChannel.appendLine("\n📋 Steps to start the server:");
    outputChannel.appendLine("   METHOD 1: Use extension command (recommended)");
    outputChannel.appendLine("   1. Press F1 → 'SageMaker: Start Local Server'");
    outputChannel.appendLine("   2. This will try to trigger AWS Toolkit to start the server");
    outputChannel.appendLine("\n   METHOD 2: Use AWS Toolkit UI");
    outputChannel.appendLine("   1. Open AWS Toolkit sidebar (click AWS icon in left sidebar)");
    outputChannel.appendLine("   2. Find your SageMaker Space in the list");
    outputChannel.appendLine("   3. Right-click the Space (NOT the app) → 'Open Remote Connection'");
    outputChannel.appendLine("   4. Wait for server to start (5-10 seconds)");
    outputChannel.appendLine("   5. You should see a notification: 'Local server started'");
    outputChannel.appendLine("   6. Verify with: F1 → 'SageMaker: Check SageMaker Connection Status'");
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
      await vscode.commands.executeCommand("workbench.view.extension.aws-toolkit");
    } else if (action === "Fix Code Wrapper") {
      vscode.commands.executeCommand("sagemaker-remote.fixCodeWrapper");
    }
  }

  /**
   * Handle case when server is not accessible
   */
  private static async handleServerNotAccessible(
    outputChannel: vscode.OutputChannel,
    serverInfo: any
  ): Promise<void> {
    outputChannel.appendLine(
      `\n⚠️  WARNING: Server info file exists but server is not running or accessible!`
    );
    outputChannel.appendLine(`   PID: ${serverInfo.pid}, Port: ${serverInfo.port}`);
    if (serverInfo.error) {
      outputChannel.appendLine(`   Error: ${serverInfo.error}`);
    }
    outputChannel.appendLine("\n💡 The server process has stopped (this is common). Restart it:");
    outputChannel.appendLine("   1. Open AWS Toolkit sidebar (click AWS icon)");
    outputChannel.appendLine("   2. Find your SageMaker Space in the list");
    outputChannel.appendLine("   3. Right-click the Space (NOT the app) → 'Open Remote Connection'");
    outputChannel.appendLine("   4. Wait 5-10 seconds for server to restart");
    outputChannel.appendLine("   5. You should see a notification: 'Local server started'");

    const action = await vscode.window.showWarningMessage(
      "Server exists but is not accessible. Restart the server via AWS Toolkit.",
      "Check Status",
      "Open AWS Toolkit"
    );

    if (action === "Check Status") {
      vscode.commands.executeCommand("sagemaker-remote.checkStatus");
    } else if (action === "Open AWS Toolkit") {
      await vscode.commands.executeCommand("workbench.view.extension.aws-toolkit");
    }
  }

  /**
   * Handle case when server stopped between checks
   */
  private static async handleServerStopped(
    outputChannel: vscode.OutputChannel
  ): Promise<void> {
    outputChannel.appendLine("\n❌ ERROR: Server stopped after initial check!");
    outputChannel.appendLine("   The server was running but stopped before connection attempt.");
    outputChannel.appendLine("\n💡 This happens when the server process stops between checks.");
    outputChannel.appendLine("   Please restart the server via AWS Toolkit and try again.");
    outputChannel.appendLine("\n📋 Steps to restart:");
    outputChannel.appendLine("   1. Open AWS Toolkit sidebar (click AWS icon)");
    outputChannel.appendLine("   2. Navigate to: SageMaker AI → Studio → Domain → SPACES");
    outputChannel.appendLine("   3. Right-click on your SPACE (NOT the app)");
    outputChannel.appendLine("   4. Click: 'Open Remote Connection'");
    outputChannel.appendLine("   5. Wait 10-15 seconds for server to start");
    outputChannel.appendLine("   6. Then try connecting again");

    const action = await vscode.window.showErrorMessage(
      "Server stopped before connection. Restart the server via AWS Toolkit.",
      "Open AWS Toolkit",
      "Check Status"
    );

    if (action === "Open AWS Toolkit") {
      await vscode.commands.executeCommand("workbench.view.extension.aws-toolkit");
    } else if (action === "Check Status") {
      vscode.commands.executeCommand("sagemaker-remote.checkStatus");
    }
  }

  /**
   * Handle case when PowerShell script is not found
   */
  private static async handleScriptNotFound(
    outputChannel: vscode.OutputChannel
  ): Promise<void> {
    outputChannel.appendLine(
      `\n⚠️  WARNING: PowerShell script not found: ${ServerManager.getConnectionScriptPath()}`
    );
    outputChannel.appendLine("   This script is created by AWS Toolkit when you start the server.");
    outputChannel.appendLine("   Try restarting the local server via AWS Toolkit.");

    const scriptAction = await vscode.window.showWarningMessage(
      "PowerShell script not found. Restart the local server via AWS Toolkit.",
      "Check Status"
    );
    if (scriptAction === "Check Status") {
      vscode.commands.executeCommand("sagemaker-remote.checkStatus");
    }
  }

  /**
   * Initiate Remote-SSH connection
   */
  private static async initiateConnection(
    outputChannel: vscode.OutputChannel,
    sshHost: string,
    remoteSSH: any
  ): Promise<void> {
    const commands = await vscode.commands.getCommands();

    // Try different command variations based on Remote-SSH extension type
    let connectCommand: string | null = null;

    if (remoteSSH.type === "cursor") {
      // Cursor Remote-SSH commands
      if (commands.includes("remote-ssh.connectToHost")) {
        connectCommand = "remote-ssh.connectToHost";
      } else if (commands.includes("remote-ssh.connect")) {
        connectCommand = "remote-ssh.connect";
      } else if (commands.includes("opensshremotes.connectToHost")) {
        connectCommand = "opensshremotes.connectToHost";
      } else if (commands.includes("opensshremotes.connect")) {
        connectCommand = "opensshremotes.connect";
      } else if (commands.includes("opensshremotes.addNewSshHost")) {
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
      await this.handleNoConnectCommand(outputChannel, sshHost, remoteSSH);
      return;
    }

    outputChannel.appendLine(`Using command: ${connectCommand}`);

    try {
      if (
        connectCommand === "remote-ssh.connectToHost" ||
        connectCommand === "remote-ssh.connect" ||
        connectCommand === "opensshremotes.connectToHost" ||
        connectCommand === "opensshremotes.connect"
      ) {
        await vscode.commands.executeCommand(connectCommand, sshHost);
        outputChannel.appendLine(`Attempting to connect to "${sshHost}"...`);
      } else if (connectCommand === "opensshremotes.addNewSshHost") {
        await this.handlePickerConnection(outputChannel, sshHost);
        return;
      }
    } catch (cmdError: any) {
      if (remoteSSH.type === "cursor") {
        await this.handleManualConnection(outputChannel, sshHost);
        return;
      }
      throw cmdError;
    }

    outputChannel.appendLine("\n✅ All prerequisites verified. Initiating connection...");
    vscode.window.showInformationMessage("Connecting to SageMaker via Remote-SSH...");
  }

  /**
   * Handle case when no connect command is found
   */
  private static async handleNoConnectCommand(
    outputChannel: vscode.OutputChannel,
    sshHost: string,
    remoteSSH: any
  ): Promise<void> {
    outputChannel.appendLine(`❌ Remote-SSH connect command not found.`);
    if (remoteSSH.type === "cursor") {
      outputChannel.appendLine(`\n💡 Solution: Use Command Palette to connect manually`);
      outputChannel.appendLine(`   1. Press F1 (or Ctrl+Shift+P)`);
      outputChannel.appendLine(`   2. Type: "Remote-SSH: Connect to Host"`);
      outputChannel.appendLine(`   3. Select "${sshHost}" from the list`);

      await vscode.commands.executeCommand("workbench.action.showCommands");
      vscode.window.showInformationMessage(
        `Please type "Remote-SSH: Connect to Host" in the Command Palette, then select "${sshHost}"`
      );
    } else {
      const errorMsg =
        "Remote-SSH connect command not found. Please check the Remote-SSH extension is installed and activated.";
      vscode.window.showErrorMessage(errorMsg);
    }
  }

  /**
   * Handle connection via host picker
   */
  private static async handlePickerConnection(
    outputChannel: vscode.OutputChannel,
    sshHost: string
  ): Promise<void> {
    const sshConfigPath = SSHConfigManager.getSSHConfigPath();

    if (!fs.existsSync(sshConfigPath)) {
      outputChannel.appendLine(`\n❌ SSH config file doesn't exist!`);
      outputChannel.appendLine(`   Please run: "SageMaker: Setup SageMaker Connection"`);
      vscode.window
        .showErrorMessage("SSH config file not found. Run Setup command first.", "Run Setup")
        .then((selection) => {
          if (selection === "Run Setup") {
            vscode.commands.executeCommand("sagemaker-remote.setup");
          }
        });
      return;
    }

    const configContent = fs.readFileSync(sshConfigPath, "utf8");
    if (!configContent.includes(`Host ${sshHost}`)) {
      outputChannel.appendLine(`\n❌ SSH config doesn't contain "Host ${sshHost}" entry!`);
      outputChannel.appendLine(`   Please run: "SageMaker: Setup SageMaker Connection"`);
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
    }

    // Use manual connection method for Cursor (more reliable)
    outputChannel.appendLine(`\n💡 Using manual connection method (works reliably with Cursor)`);
    outputChannel.appendLine(`\n📝 Connection Steps:`);
    outputChannel.appendLine(`   1. Command Palette will open`);
    outputChannel.appendLine(`   2. Type: "Remote-SSH: Connect to Host"`);
    outputChannel.appendLine(`   3. Press Enter`);
    outputChannel.appendLine(`   4. When prompted for hostname, type: ${sshHost}`);
    outputChannel.appendLine(`   5. Press Enter to connect`);
    outputChannel.appendLine(
      `\n✅ This method works even if "${sshHost}" doesn't appear in the picker list.`
    );

    await vscode.commands.executeCommand("workbench.action.showCommands");
    vscode.window.showInformationMessage(
      `Type "Remote-SSH: Connect to Host", then enter "${sshHost}" as the hostname when prompted`,
      "Got it"
    );
  }

  /**
   * Handle manual connection fallback
   */
  private static async handleManualConnection(
    outputChannel: vscode.OutputChannel,
    sshHost: string
  ): Promise<void> {
    outputChannel.appendLine(`Command failed, trying alternative approach...`);
    await vscode.commands.executeCommand("workbench.action.showCommands");
    outputChannel.appendLine(`Please type "Remote-SSH: Connect to Host" and select "${sshHost}"`);
    vscode.window.showInformationMessage(
      `Please select "${sshHost}" from the Remote-SSH host picker`
    );
  }
}

