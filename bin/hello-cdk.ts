#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {Stack} from '@aws-cdk/core';
import {FargateConfig} from "../lib/FargateConfig";
import {ECRConfig} from "../lib/ECRConfig";
import {RDSConfig} from "../lib/RDSConfig";
import {Secrets} from "../lib/Secrets";
import {AppConfiguration} from "../lib/DataManagement";
import * as ecs from "@aws-cdk/aws-ecs";
import * as sm from "@aws-cdk/aws-secretsmanager";
import {databaseDefaultName, rdsVpcName} from "../lib/consts/RDSConstants";
import * as ec2 from "@aws-cdk/aws-ec2";

const app = new cdk.App();

let appStack = new Stack(app, 'LiAppStack');
let rdbSecret = Secrets.buildRDBSecret(appStack);

let vpc = new ec2.Vpc(appStack, rdsVpcName, {maxAzs: 2});

let rdsConfig = new RDSConfig(appStack, vpc);
let databaseCluster = rdsConfig.configureRDB(rdbSecret);
let databaseInstance = rdsConfig.configureTestRDB();

let port = databaseCluster.clusterEndpoint.port;
let hostname = databaseCluster.clusterEndpoint.hostname;

let appConfiguration: AppConfiguration = {
    appVars: {
        "SPRING_PROFILES_ACTIVE": "prod",
        "RDB_URL": `jdbc:mysql://${hostname}:3306/${databaseDefaultName}?useSsl=true`
    },
    appSecrets: {
        "RDB_PASSWORD": buildAppSecret(rdbSecret, "password"),
        "RDB_USERNAME": buildAppSecret(rdbSecret, "username")
    }
}


let fargateConfig = new FargateConfig(appStack);
let ecrConfig = new ECRConfig(new Stack(app, 'LiEcsStack'));

fargateConfig.storeAppConfiguration(ecrConfig.getOrCreateRepository(), appConfiguration);


function buildAppSecret(smSecret: sm.Secret, key: string) {
    return ecs.Secret.fromSecretsManager(smSecret, key);
}
