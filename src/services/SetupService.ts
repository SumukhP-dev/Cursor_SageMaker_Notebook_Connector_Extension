/**
 * Service for setting up SageMaker connection
 */
import * as vscode from "vscode";
import * as path from "path";
import { ExecUtils } from "../utils/ExecUtils";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { SSHConfigManager } from "./SSHConfigManager";

export class SetupService {
  /**
   * Setup SageMaker connection
   */
  static async setupSageMakerConnection(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Setup");
    outputChannel.show();

    try {
      outputChannel.appendLine("Setting up SageMaker connection...\n");

      const checks = await PrerequisitesChecker.checkAll();

      if (!checks.awsCli) {
        outputChannel.appendLine("❌ AWS CLI not found. Please install from: https://aws.amazon.com/cli/");
        vscode.window.showErrorMessage("AWS CLI not found. Please install it first.");
        return;
      }

      if (!checks.sessionManagerPlugin) {
        outputChannel.appendLine("Installing Session Manager Plugin...");
        await this.installSessionManagerPlugin();
        outputChannel.appendLine("✅ Session Manager Plugin installed");
      }

      if (!checks.remoteSSH) {
        outputChannel.appendLine("❌ Remote-SSH extension not found. Please install it from the marketplace.");
        outputChannel.appendLine("   Supported extensions: ms-vscode-remote.remote-ssh (VS Code) or anysphere.remote-ssh (Cursor)");
        vscode.window.showErrorMessage(
          "Please install the Remote-SSH extension first (ms-vscode-remote.remote-ssh or anysphere.remote-ssh)."
        );
        return;
      }

      // Setup SSH config
      if (!checks.sshConfig) {
        outputChannel.appendLine("Setting up SSH config...");
        const spaceArn = await vscode.window.showInputBox({
          prompt: "Enter SageMaker Space ARN",
          placeHolder: "arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name",
        });

        if (!spaceArn) {
          throw new Error("Space ARN is required");
        }

        await SSHConfigManager.setupSSHConfig(spaceArn);
        outputChannel.appendLine("✅ SSH config setup complete");
      }

      outputChannel.appendLine("\n✅ Setup complete!");
      vscode.window.showInformationMessage("SageMaker connection setup complete!");
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("SageMaker Setup");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
    }
  }

  /**
   * Install Session Manager Plugin
   */
  private static async installSessionManagerPlugin(): Promise<void> {
    const downloadUrl =
      "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe";
    const installerPath = path.join(process.env.TEMP || "", "SessionManagerPluginSetup.exe");

    // Download and install
    await ExecUtils.execute(
      `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${installerPath}'"`
    );
    await ExecUtils.execute(`"${installerPath}" /S`);
  }
}

