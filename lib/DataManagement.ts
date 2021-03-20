import {Secret} from "@aws-cdk/aws-ecs/lib/container-definition";


export interface AppConfiguration {
    readonly appSecrets: AppSecrets
    readonly appVars: AppVars
}

interface AppSecrets {
    [key: string]: Secret
}

interface AppVars {
    [key: string]: string
}

