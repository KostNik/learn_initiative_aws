import * as cdk from '@aws-cdk/core';
import {Duration, Stack} from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import {FargatePlatformVersion, Protocol} from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import * as logs from "@aws-cdk/aws-logs";
import * as elb from "@aws-cdk/aws-elasticloadbalancingv2";
import {IpAddressType} from "@aws-cdk/aws-elasticloadbalancingv2";

import {
    clusterName,
    executionRoleName,
    fargateServiceName,
    fargateTaskDefinition,
    fargateTaskDefinitionContainer,
    fargateTaskFamily,
    loadBalancerListener,
    loadBalancerName,
    loadBalancerTargetGroup,
    securityGroup,
    servicePrincipal,
    vpcName
} from "./consts/ECSConstants";
import {IRepository} from "@aws-cdk/aws-ecr";
import {AppConfiguration} from "./DataManagement";

export class FargateConfig {
    private readonly _stack: Stack;

    constructor(stack: cdk.Stack) {
        this._stack = stack;
    }

    storeAppConfiguration(repository: IRepository, appConf: AppConfiguration) {
        let vpc = new ec2.Vpc(this._stack, vpcName, {
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            cidr: "10.0.0.0/16",
        });

        let cluster = new ecs.Cluster(this._stack, clusterName, {
            clusterName: clusterName,
            vpc: vpc
        })

        let execRole = new iam.Role(this._stack, executionRoleName, {
            assumedBy: new iam.ServicePrincipal(servicePrincipal),
            roleName: executionRoleName
        })

        let logDriver = FargateConfig.defineLogs(this._stack);

        execRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: ["*"],
                actions: [
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ]
            }
        ))

        let taskDefinition = new ecs.FargateTaskDefinition(this._stack, fargateTaskDefinition, {
            executionRole: execRole,
            taskRole: execRole,
            cpu: 256,
            memoryLimitMiB: 512,
            family: fargateTaskFamily
        })

        let containerImage = new ecs.EcrImage(repository, "LATEST");

        new ecs.ContainerDefinition(this._stack, fargateTaskDefinitionContainer, {
            taskDefinition: taskDefinition,
            image: containerImage,
            logging: logDriver,
            environment: appConf.appVars,
            essential: true,
            secrets: appConf.appSecrets
        }).addPortMappings({
            containerPort: 8080,
            protocol: Protocol.TCP
        });

        const uiTaskSecurityGroup = new ec2.SecurityGroup(this._stack, securityGroup, {
            vpc: vpc,
            allowAllOutbound: true,
            securityGroupName: securityGroup
        });

        uiTaskSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080));

        let service = new ecs.FargateService(this._stack, fargateServiceName,
            {
                cluster: cluster,
                taskDefinition: taskDefinition,
                serviceName: fargateServiceName,
                maxHealthyPercent: 200,
                minHealthyPercent: 0,
                platformVersion: FargatePlatformVersion.LATEST,
                securityGroups: [uiTaskSecurityGroup],
                desiredCount: 1,
                assignPublicIp: true
            })

        FargateConfig.createLoadBalancer(this._stack, service, vpc, uiTaskSecurityGroup)
    }


    private static defineLogs(stack: Stack) {
        return ecs.LogDrivers.awsLogs({
            logGroup: new logs.LogGroup(stack, 'StoreLogs', {
                retention: logs.RetentionDays.ONE_DAY
            }),
            streamPrefix: "StoreLogs"
        });
    }

    private static createLoadBalancer(
        scope: cdk.Construct,
        service: ecs.FargateService,
        vpc: ec2.IVpc,
        securityGroup: ec2.SecurityGroup
    ) {

        const balancer = new elb.ApplicationLoadBalancer(scope, loadBalancerName, {
            vpc: vpc,
            securityGroup: securityGroup,
            internetFacing: true,
            ipAddressType: IpAddressType.IPV4,
            loadBalancerName: loadBalancerName
        });


        const target = new elb.ApplicationTargetGroup(scope, loadBalancerTargetGroup, {
            targetType: elb.TargetType.IP,
            targetGroupName: loadBalancerTargetGroup,
            port: 8080,
            vpc: vpc,
            stickinessCookieDuration: Duration.minutes(30),
            healthCheck: {
                path: "/actuator/health",
                protocol: elb.Protocol.HTTP,
                unhealthyThresholdCount: 5,
                interval: Duration.seconds(60),
                timeout: Duration.seconds(30)
            },
            targets: [service]
        });

        new elb.ApplicationListener(scope, loadBalancerListener, {
            loadBalancer: balancer,
            port: 80,
            defaultTargetGroups: [target]
        });

    }
}
