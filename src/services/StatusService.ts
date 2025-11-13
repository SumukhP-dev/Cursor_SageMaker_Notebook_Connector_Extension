/**
 * Service for checking connection status
 */
import * as vscode from "vscode";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { ServerManager } from "./ServerManager";

export class StatusService {
  /**
   * Check and display connection status
   */
  static async checkConnectionStatus(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Status");
    outputChannel.show();

    try {
      outputChannel.appendLine("Checking SageMaker connection status...\n");

      const checks = await PrerequisitesChecker.checkAll();
      const remoteSSH = await PrerequisitesChecker.checkRemoteSSHExtension();

      outputChannel.appendLine("Prerequisites:");

      // AWS CLI
      outputChannel.appendLine(`  AWS CLI: ${checks.awsCli ? "✅ Installed" : "❌ Not found"}`);
      if (!checks.awsCli) {
        outputChannel.appendLine("    → Install: Download from https://aws.amazon.com/cli/");
        outputChannel.appendLine("    → Or run: winget install Amazon.AWSCLI");
      }

      // Session Manager Plugin
      outputChannel.appendLine(
        `  Session Manager Plugin: ${checks.sessionManagerPlugin ? "✅ Installed" : "❌ Not found"}`
      );
      if (!checks.sessionManagerPlugin) {
        outputChannel.appendLine('    → Install: code --command "SageMaker: Setup SageMaker Connection"');
        outputChannel.appendLine(
          "    → Or download: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe"
        );
      }

      // Remote-SSH Extension
      let remoteSSHInfo = "❌ Not found";
      if (checks.remoteSSH) {
        if (remoteSSH.type === "cursor") {
          remoteSSHInfo = "✅ Installed (anysphere.remote-ssh - Cursor)";
        } else if (remoteSSH.type === "vscode") {
          remoteSSHInfo = "✅ Installed (ms-vscode-remote.remote-ssh - VS Code)";
        } else {
          remoteSSHInfo = "✅ Installed (unknown version)";
        }
      }

      outputChannel.appendLine(`  Remote-SSH Extension: ${remoteSSHInfo}`);
      if (!checks.remoteSSH) {
        outputChannel.appendLine("    → Install: Remote-SSH extension (ms-vscode-remote.remote-ssh or anysphere.remote-ssh)");
      }

      // SSH Config
      outputChannel.appendLine(`  SSH Config: ${checks.sshConfig ? "✅ Configured" : "❌ Not configured"}`);
      if (!checks.sshConfig) {
        outputChannel.appendLine('    → Setup: code --command "SageMaker: Setup SageMaker Connection"');
      }

      // AWS Toolkit
      outputChannel.appendLine(`  AWS Toolkit: ${checks.awsToolkit ? "✅ Installed" : "❌ Not found"}`);
      if (!checks.awsToolkit) {
        outputChannel.appendLine("    → Install: code --install-extension amazonwebservices.aws-toolkit-vscode");
      }

      if (!checks.allPassed) {
        outputChannel.appendLine("\n❌ Some prerequisites are missing.");
        outputChannel.appendLine('Run "SageMaker: Setup SageMaker Connection" to fix issues.');
      } else {
        outputChannel.appendLine("\n✅ All prerequisites met!");
      }

      // Check if server is running
      const serverInfo = await ServerManager.checkServerStatus();
      if (serverInfo.running) {
        outputChannel.appendLine(`\n✅ Local server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
      } else {
        outputChannel.appendLine("\n⚠️  Local server is not running.");
        outputChannel.appendLine('Start it via AWS Toolkit: Right-click Space → "Open Remote Connection"');
      }
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("SageMaker Status");
      outputChannel.appendLine(`Error: ${error.message}`);
    }
  }
}

