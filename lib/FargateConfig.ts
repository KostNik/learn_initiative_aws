import * as cdk from '@aws-cdk/core';
import {Duration, Stack} from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import {SubnetType} from "@aws-cdk/aws-ec2";
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
} from "./StackConstants";
import {IRepository} from "@aws-cdk/aws-ecr";

export class FargateConfig {

    constructor(stack: cdk.Stack, repository: IRepository) {

        let vpc = new ec2.Vpc(stack, vpcName, {
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            cidr: "10.0.0.0/16",
        });

        let cluster = new ecs.Cluster(stack, clusterName, {
            clusterName: clusterName,
            vpc: vpc
        })

        let execRole = new iam.Role(stack, executionRoleName, {
            assumedBy: new iam.ServicePrincipal(servicePrincipal),
            roleName: executionRoleName
        })

        let logDriver = FargateConfig.defineLogs(stack);

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

        let taskDefinition = new ecs.FargateTaskDefinition(stack, fargateTaskDefinition, {
            executionRole: execRole,
            taskRole: execRole,
            cpu: 256,
            memoryLimitMiB: 512,
            family: fargateTaskFamily
        })

        let containerImage = new ecs.EcrImage(repository, "LATEST");

        new ecs.ContainerDefinition(stack, fargateTaskDefinitionContainer, {
            taskDefinition: taskDefinition,
            image: containerImage,
            logging: logDriver,
            environment: {"some_key": "some_value"},
            essential: true,
        }).addPortMappings({
            containerPort: 8080,
            protocol: Protocol.TCP
        });

        const uiTaskSecurityGroup = new ec2.SecurityGroup(stack, securityGroup, {
            vpc: vpc,
            allowAllOutbound: true,
            securityGroupName: securityGroup
        });

        uiTaskSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
        uiTaskSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080));

        let service = new ecs.FargateService(stack, fargateServiceName,
            {
                cluster: cluster,
                taskDefinition: taskDefinition,
                serviceName: fargateServiceName,
                maxHealthyPercent: 100,
                platformVersion: FargatePlatformVersion.LATEST,
                securityGroups: [uiTaskSecurityGroup],
                desiredCount: 1,
                assignPublicIp: true
            })

        FargateConfig.createLoadBalancer(stack, service, vpc, uiTaskSecurityGroup)

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

        const listener = new elb.ApplicationListener(scope, loadBalancerListener, {
            loadBalancer: balancer,
            port: 80,
            defaultTargetGroups: [target]
        });

    }
}