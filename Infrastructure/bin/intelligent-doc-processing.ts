#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { IntelligentDocProcessingStack } from '../lib/intelligent-doc-processing-stack';

const app = new cdk.App();
new IntelligentDocProcessingStack(app, 'IntelligentDocProcessingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});