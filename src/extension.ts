/**
 * Main entry point for the SageMaker Remote Connection extension
 */
import * as vscode from "vscode";
import { ConnectionManager } from "./services/ConnectionManager";
import { StatusService } from "./services/StatusService";
import { SetupService } from "./services/SetupService";
import { ServerStartService } from "./services/ServerStartService";
import { SSHConfigManager } from "./services/SSHConfigManager";
import { DiagnosticsService } from "./services/DiagnosticsService";
import { FixService } from "./services/FixService";
import { QuickStartService } from "./services/QuickStartService";

export function activate(context: vscode.ExtensionContext) {
  console.log("SageMaker Remote Connection extension is now active!");

  // Register commands
  const connectCommand = vscode.commands.registerCommand(
    "sagemaker-remote.connect",
    async () => {
      await ConnectionManager.connectToSageMaker(context);
    }
  );

  const checkStatusCommand = vscode.commands.registerCommand(
    "sagemaker-remote.checkStatus",
    async () => {
      await StatusService.checkConnectionStatus();
    }
  );

  const debugSSHConfigCommand = vscode.commands.registerCommand(
    "sagemaker-remote.debugSSHConfig",
    async () => {
      await SSHConfigManager.debugSSHConfig();
    }
  );

  const setupCommand = vscode.commands.registerCommand(
    "sagemaker-remote.setup",
    async () => {
      await SetupService.setupSageMakerConnection(context);
    }
  );

  const startServerCommand = vscode.commands.registerCommand(
    "sagemaker-remote.startServer",
    async () => {
      await ServerStartService.startLocalServer();
    }
  );

  const diagnoseCommand = vscode.commands.registerCommand(
    "sagemaker-remote.diagnose",
    async () => {
      await DiagnosticsService.diagnoseConnection();
    }
  );

  const fixArnConversionCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixArnConversion",
    async () => {
      await FixService.fixArnConversion();
    }
  );

  const fixCodeWrapperCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixCodeWrapper",
    async () => {
      await FixService.fixCodeWrapper();
    }
  );

  const fixSshConfigCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixSshConfig",
    async () => {
      await FixService.fixSSHConfig();
    }
  );

  const applyAllFixesCommand = vscode.commands.registerCommand(
    "sagemaker-remote.applyAllFixes",
    async () => {
      await FixService.applyAllFixes();
    }
  );

  const quickStartCommand = vscode.commands.registerCommand(
    "sagemaker-remote.quickStart",
    async () => {
      await QuickStartService.quickStart(context);
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

export function deactivate() {}
