/**
 * Shared types and interfaces for the Cursor SageMaker Notebook Connector extension
 */

export interface PrerequisitesResult {
  allPassed: boolean;
  awsCli: boolean;
  sessionManagerPlugin: boolean;
  remoteSSH: boolean;
  sshConfig: boolean;
  awsToolkit: boolean;
  errors: string[];
}

export interface ServerStatus {
  running: boolean;
  pid?: number;
  port?: number;
  accessible?: boolean;
  error?: string;
}

export interface CodeWrapperIssue {
  hasIssue: boolean;
  message: string;
}

export interface RemoteSSHExtension {
  installed: boolean;
  type: 'cursor' | 'vscode' | 'none';
  extensionId: string | null;
}

