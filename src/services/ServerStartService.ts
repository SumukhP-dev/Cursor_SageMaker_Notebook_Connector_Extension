/**
 * Service for starting the local server
 */
import * as vscode from "vscode";
import * as path from "path";
import { ServerManager } from "./ServerManager";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";

export class ServerStartService {
  /**
   * Attempt to start the local server
   */
  static async startLocalServer(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Server");
    outputChannel.show();

    try {
      outputChannel.appendLine("Attempting to start local server...\n");

      // First check if server is already running
      const serverInfo = await ServerManager.checkServerStatus();
      if (serverInfo.running) {
        outputChannel.appendLine(`✅ Server is already running! (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
        vscode.window.showInformationMessage("Local server is already running");
        return;
      }

      outputChannel.appendLine("Server is not running. Trying to trigger AWS Toolkit...\n");

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
            outputChannel.appendLine(`   Executing command to trigger server start...`);
            commandFound = true;

            try {
              await vscode.commands.executeCommand(cmd);
              outputChannel.appendLine(`   Command executed. Waiting for server to start...`);
            } catch (cmdError: any) {
              outputChannel.appendLine(
                `   Command executed (may have failed, but server might start): ${cmdError.message}`
              );
            }
            break;
          }
        } catch {
          // Continue to next command
        }
      }

      if (!commandFound) {
        outputChannel.appendLine("⚠️  Could not find AWS Toolkit commands to trigger server start.");
        outputChannel.appendLine("\n💡 Alternative methods to start the server:");
        outputChannel.appendLine("   1. Open AWS Toolkit sidebar (AWS icon)");
        outputChannel.appendLine("   2. Navigate to: SageMaker AI → Studio → Domain → Apps");
        outputChannel.appendLine("   3. Right-click your Space → 'Open Remote Connection'");
        outputChannel.appendLine("   4. Even if connection fails, it might start the server");
      }

      // Wait a bit and check if server started
      outputChannel.appendLine("\n⏳ Waiting 5 seconds for server to start...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const newServerInfo = await ServerManager.checkServerStatus();
      if (newServerInfo.running) {
        outputChannel.appendLine(`\n✅ SUCCESS! Server is now running! (PID: ${newServerInfo.pid}, Port: ${newServerInfo.port})`);
        vscode.window.showInformationMessage("Local server started successfully!");
      } else {
        outputChannel.appendLine("\n⚠️  Server did not start automatically.");
        outputChannel.appendLine("\n📋 Try these steps:");
        outputChannel.appendLine("   1. Open AWS Toolkit sidebar");
        outputChannel.appendLine("   2. Right-click your SageMaker Space → 'Open Remote Connection'");
        outputChannel.appendLine("   3. Check Output panel (Ctrl+Shift+U) → 'AWS Toolkit' for errors");
        outputChannel.appendLine("   4. Look for 'code --folder-uri' errors (indicates wrapper issue)");

        // Check for code wrapper issue
        const codeWrapperIssue = await CodeWrapperChecker.checkCodeWrapperIssue();
        if (codeWrapperIssue.hasIssue) {
          outputChannel.appendLine("\n⚠️  CODE WRAPPER ISSUE DETECTED!");
          outputChannel.appendLine(`   ${codeWrapperIssue.message}`);
          outputChannel.appendLine("\n💡 This is likely preventing the server from starting.");
          outputChannel.appendLine("   Fix it by running: .\\scripts\\fix_cursor_code_command.ps1");

          const fixAction = await vscode.window.showWarningMessage(
            "Code wrapper issue detected. This might prevent server from starting. Fix it now?",
            "Fix Code Wrapper",
            "Check Status"
          );

          if (fixAction === "Fix Code Wrapper") {
            vscode.commands.executeCommand("sagemaker-remote.fixCodeWrapper");
          } else if (fixAction === "Check Status") {
            vscode.commands.executeCommand("sagemaker-remote.checkStatus");
          }
        }
      }
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("SageMaker Server");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Failed to start server: ${error.message}`);
    }
  }
}

