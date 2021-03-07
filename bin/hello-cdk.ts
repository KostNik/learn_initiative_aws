#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {EcsStack} from "../lib/EcsStack";
import {FargateConfig} from "../lib/FargateConfig";
import {ECRConfig} from "../lib/ECRConfig";
import {RDSConfig} from "../lib/RDSConfig";
import {Stack} from "@aws-cdk/core";

const app = new cdk.App();
let ecsStack = new EcsStack(app, 'LiEcsStack');
let ecrConfig = new ECRConfig(ecsStack);
let fargateConfig = new FargateConfig(ecsStack, ecrConfig.getOrCreateRepository());


let rdsStack = new Stack(app, 'LiRdsStack');
let auroraConfig = new RDSConfig(rdsStack);
