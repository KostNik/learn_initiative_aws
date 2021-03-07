import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, SecretValue} from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import {Port, SubnetType} from "@aws-cdk/aws-ec2";
import * as rds from "@aws-cdk/aws-rds";
import {AuroraMysqlEngineVersion} from "@aws-cdk/aws-rds";

import {vpcName} from "./consts/ECSConstants";
import {DatabaseClusterProps} from "@aws-cdk/aws-rds/lib/cluster";
import {IClusterEngine} from "@aws-cdk/aws-rds/lib/cluster-engine";
import {InstanceProps} from "@aws-cdk/aws-rds/lib/props";
import {databaseAdminUserName, databaseDefaultName, rdsClusterName} from "./consts/RDSConstants";
import * as kms from "@aws-cdk/aws-kms";
import {RetentionDays} from "@aws-cdk/aws-logs";

export class RDSConfig {

    constructor(stack: cdk.Stack) {

        let vpc = new ec2.Vpc(stack, vpcName, {
            maxAzs: 2,
        });

        let clusterEngine: IClusterEngine = rds.DatabaseClusterEngine.auroraMysql({
            version: AuroraMysqlEngineVersion.VER_2_09_1
        })

        let dbInstanceProps: InstanceProps = {
            vpc: vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            }
        }

        let adminSecret = new kms.Key(stack, "rdsAdminSecret", {
            description: "The secret for RDS admin user",
            enableKeyRotation: false,
            enabled: true,
            removalPolicy: RemovalPolicy.DESTROY
        })

        let dbSecret = new rds.DatabaseSecret(stack, "rds-li-secret", {
            username: databaseAdminUserName
        })

        // let credentials = rds.Credentials.fromSecret(dbSecret);
        let credentials = rds.Credentials.fromPassword(databaseAdminUserName, SecretValue.plainText("password1"));

        let clusterProps: DatabaseClusterProps = {
            engine: clusterEngine,
            instanceProps: dbInstanceProps,
            defaultDatabaseName: databaseDefaultName,
            removalPolicy: RemovalPolicy.DESTROY,
            instances: 1,
            credentials: credentials,
            cloudwatchLogsRetention: RetentionDays.ONE_DAY
        }

        let databaseCluster = new rds.DatabaseCluster(stack, rdsClusterName, clusterProps);
        databaseCluster.connections.allowFromAnyIpv4(Port.allTcp())
    }
}