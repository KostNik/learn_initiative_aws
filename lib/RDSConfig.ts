import * as cdk from '@aws-cdk/core';
import {RemovalPolicy} from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import {Port, SubnetType} from "@aws-cdk/aws-ec2";
import * as rds from "@aws-cdk/aws-rds";
import {AuroraMysqlEngineVersion} from "@aws-cdk/aws-rds";

import {DatabaseClusterProps} from "@aws-cdk/aws-rds/lib/cluster";
import {IClusterEngine} from "@aws-cdk/aws-rds/lib/cluster-engine";
import {InstanceProps} from "@aws-cdk/aws-rds/lib/props";
import {databaseDefaultName, rdsClusterName, rdsVpcName} from "./consts/RDSConstants";
import {RetentionDays} from "@aws-cdk/aws-logs";
import {Secret} from "@aws-cdk/aws-secretsmanager";

export class RDSConfig {

    private readonly stack: cdk.Stack;

    constructor(stack: cdk.Stack) {
        this.stack = stack;
    }

    configureRDB(dbSecret: Secret): void {
        let vpc = new ec2.Vpc(this.stack, rdsVpcName, {
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

        let credentials = rds.Credentials.fromSecret(dbSecret);

        let clusterProps: DatabaseClusterProps = {
            engine: clusterEngine,
            instanceProps: dbInstanceProps,
            defaultDatabaseName: databaseDefaultName,
            removalPolicy: RemovalPolicy.DESTROY,
            instances: 1,
            credentials: credentials,
            cloudwatchLogsRetention: RetentionDays.ONE_DAY
        }

        let databaseCluster = new rds.DatabaseCluster(this.stack, rdsClusterName, clusterProps);
        databaseCluster.connections.allowFromAnyIpv4(Port.allTcp())
    }

}