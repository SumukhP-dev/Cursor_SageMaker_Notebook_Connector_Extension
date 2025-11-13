/**
 * Utility for generating SSH hostnames from SageMaker ARNs
 */
export class HostnameGenerator {
  /**
   * Convert a SageMaker Space ARN to SSH hostname format
   * Format: sm_lc_arn_._aws_._sagemaker_._region_._account_._space__domain__space-name
   */
  static generateHostname(arn: string): string {
    const parts = arn.split(":");
    const resource = parts[5]; // space/d-xxx/space-name
    const resourceParts = resource.split("/");

    const region = parts[3];
    const account = parts[4];
    const domain = resourceParts[1];
    const spaceName = resourceParts[2];

    return `sm_lc_arn_._aws_._sagemaker_._${region}._${account}_._space__${domain}__${spaceName}`;
  }
}

