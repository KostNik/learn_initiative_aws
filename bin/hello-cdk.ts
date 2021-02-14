#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {EcsStack} from "../lib/EcsStack";
import {FargateConfig} from "../lib/FargateConfig";
import {ECRConfig} from "../lib/ECRConfig";

const app = new cdk.App();
let ecsStack = new EcsStack(app, 'EcsStack');
let ecrConfig = new ECRConfig(ecsStack);
let fargateConfig = new FargateConfig(ecsStack, ecrConfig.getOrCreateRepository());
