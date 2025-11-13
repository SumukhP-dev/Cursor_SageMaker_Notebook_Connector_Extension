/**
 * Service for quick start automation
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { ServerManager } from "./ServerManager";
import { FixService } from "./FixService";
import { ConnectionManager } from "./ConnectionManager";

export class QuickStartService {
  /**
   * Quick Start: Automates the entire SageMaker connection process
   */
  static async quickStart(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
    outputChannel.show();
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("🚀 Quick Start: SageMaker Connection");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");

    try {
      // Step 1: Check prerequisites
      outputChannel.appendLine("Step 1: Checking prerequisites...");
      const checks = await PrerequisitesChecker.checkAll();
      if (!checks.allPassed) {
        outputChannel.appendLine(`❌ Prerequisites not met: ${checks.errors.join(", ")}`);
        vscode.window.showErrorMessage(`Prerequisites not met: ${checks.errors.join(", ")}`);
        return;
      }
      outputChannel.appendLine("✅ Prerequisites check passed");

      // Step 2: Fix ARN conversion
      outputChannel.appendLine("\nStep 2: Ensuring ARN conversion is correct...");
      try {
        await FixService.fixArnConversion();
        outputChannel.appendLine("✅ ARN conversion verified/fixed");
      } catch (error: any) {
        outputChannel.appendLine(`⚠️  ARN conversion check: ${error.message}`);
        // Continue anyway - might already be fixed
      }

      // Step 3: Remove old SSH host keys
      outputChannel.appendLine("\nStep 3: Cleaning up old SSH host keys...");
      try {
        const knownHostsPath = path.join(process.env.USERPROFILE || "", ".ssh", "known_hosts");
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
      const serverInfo = await ServerManager.checkServerStatus();

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

      outputChannel.appendLine(`✅ Server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);

      // Step 5: Final verification
      outputChannel.appendLine("\nStep 5: Final verification...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const finalCheck = await ServerManager.checkServerStatus();
      if (!finalCheck.running || !finalCheck.accessible) {
        outputChannel.appendLine("❌ Server stopped between checks!");
        outputChannel.appendLine("Please restart the server and try again.");
        vscode.window.showErrorMessage("Server stopped. Please restart it via AWS Toolkit and try again.");
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
          vscode.window.showErrorMessage("Failed to auto-connect. Please connect manually via Remote-SSH.");
        }
      }

      outputChannel.appendLine("\n========================================");
      outputChannel.appendLine("✅ Quick Start Complete!");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("\nThe connection should be establishing now.");
      outputChannel.appendLine("If the Remote-SSH window doesn't open, connect manually:");
      outputChannel.appendLine(`  F1 → Remote-SSH: Connect to Host → ${sshHost}`);
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
      outputChannel.appendLine(`\n❌ Error during quick start: ${error.message}`);
      vscode.window.showErrorMessage(`Quick start failed: ${error.message}`);
    }
  }
}

