import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, Stack} from '@aws-cdk/core';
import * as ecr from "@aws-cdk/aws-ecr";
import {IRepository, Repository} from "@aws-cdk/aws-ecr";
import {dockerRepoName} from "./consts/ECSConstants";

export class ECRConfig {
    private readonly _stack: Stack;

    constructor(stack: cdk.Stack) {
        this._stack = stack;
    }

    public getOrCreateRepository(): IRepository {
        return Repository.fromRepositoryName(this._stack, dockerRepoName, dockerRepoName)
            ||
            this.createRepository();
    }

    private createRepository(): IRepository {
        return new ecr.Repository(this._stack, dockerRepoName, {
            lifecycleRules: [
                {maxImageCount: 2, rulePriority:1,}
            ],
            removalPolicy: RemovalPolicy.DESTROY,
            repositoryName: dockerRepoName
        });
    }
}