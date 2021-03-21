import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, SecretValue} from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import {Port, SubnetType} from "@aws-cdk/aws-ec2";
import * as rds from "@aws-cdk/aws-rds";
import {AuroraMysqlEngineVersion} from "@aws-cdk/aws-rds";

import {DatabaseClusterProps} from "@aws-cdk/aws-rds/lib/cluster";
import {IClusterEngine} from "@aws-cdk/aws-rds/lib/cluster-engine";
import {InstanceProps} from "@aws-cdk/aws-rds/lib/props";
import {databaseDefaultName, rdsClusterName, rdsTestDBInstanceName} from "./consts/RDSConstants";
import {RetentionDays} from "@aws-cdk/aws-logs";
import {Secret} from "@aws-cdk/aws-secretsmanager";
import {MysqlEngineVersion} from "@aws-cdk/aws-rds/lib/instance-engine";

export class RDSConfig {

    private readonly stack: cdk.Stack;
    private readonly vpc: ec2.Vpc;

    constructor(stack: cdk.Stack, vpc: ec2.Vpc) {
        this.stack = stack;
        this.vpc = vpc;
    }

    configureRDB(dbSecret: Secret): rds.DatabaseCluster {
        let clusterEngine: IClusterEngine = rds.DatabaseClusterEngine.auroraMysql({
            version: AuroraMysqlEngineVersion.VER_2_09_1
        })

        let dbInstanceProps: InstanceProps = {
            vpc: this.vpc,
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

        return databaseCluster;
    }

    configureTestRDB(): rds.DatabaseInstance {
        const instanceEngine = rds.DatabaseInstanceEngine.mysql({
            version: MysqlEngineVersion.VER_5_7
        });

        const credentials = rds.Credentials.fromPassword("user", SecretValue.plainText("8z7UQoMv,^OuCQ"))

        const testDBInstance: rds.DatabaseInstance = new rds.DatabaseInstance(this.stack, rdsTestDBInstanceName, {
            engine: instanceEngine,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            },
            credentials: credentials,
            removalPolicy: RemovalPolicy.DESTROY,
            databaseName: databaseDefaultName
        })

        testDBInstance.connections.allowFromAnyIpv4(Port.allTcp())
        return testDBInstance;
    }

}