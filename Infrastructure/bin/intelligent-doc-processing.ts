#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { IntelligentDocProcessingStack } from '../lib/intelligent-doc-processing-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();
new IntelligentDocProcessingStack(app, 'IntelligentDocProcessingStack', {
  
});
