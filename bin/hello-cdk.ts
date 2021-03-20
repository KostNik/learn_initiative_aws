#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {Stack} from '@aws-cdk/core';
import {EcsStack} from "../lib/EcsStack";
import {FargateConfig} from "../lib/FargateConfig";
import {ECRConfig} from "../lib/ECRConfig";
import {RDSConfig} from "../lib/RDSConfig";
import {Secrets} from "../lib/Secrets";
import {AppConfiguration} from "../lib/DataManagement";
import * as ecs from "@aws-cdk/aws-ecs";
import * as sm from "@aws-cdk/aws-secretsmanager";

const app = new cdk.App();
let ecsStack = new EcsStack(app, 'LiEcsStack');
let ecrConfig = new ECRConfig(ecsStack);

let appStack = new Stack(app, 'LiAppStack');

let rdbSecret = Secrets.buildRDBSecret(appStack);

function buildAppSecret(smSecret: sm.Secret, key: string) {
    return ecs.Secret.fromSecretsManager(smSecret, key);
}

let appConfiguration: AppConfiguration = {
    appVars: {
        "SPRING_PROFILES_ACTIVE": "prod",
    },
    appSecrets: {
        "rdb_host": buildAppSecret(rdbSecret, "host"),
        "rdb_port": buildAppSecret(rdbSecret, "port"),
        "rdb_password": buildAppSecret(rdbSecret, "password"),
        "rdb_username": buildAppSecret(rdbSecret, "username")
    }
}

let fargateConfig = new FargateConfig(appStack);
fargateConfig.storeAppConfiguration(ecrConfig.getOrCreateRepository(), appConfiguration);

let auroraConfig = new RDSConfig(appStack);
auroraConfig.configureRDB(rdbSecret);
