export const GPT_4o_MIMI = 'gpt-4o-mini'
export const GPT_4o = 'gpt-4o'
export const O1_MINI = 'o1-mini'
export const O1 = 'o1'
export const O3_MINI = 'o3-mini'
export const Claude_35_Haiku = 'claude-3-5-haiku-20241022'
export const Claude_35_Sonnet = 'claude-3-5-sonnet-20241022'
export const DEEPSEEK = 'deepseek-chat'
export const DEEPSEEK_R1 = 'deepseek-reasoner'


export enum ModelType {
    FREE = 'FREE',
    PRO = 'PRO',
    PREMIUM = 'PREMIUM',
}

export const MODEL_CONFIG = {
    [GPT_4o_MIMI]: { type: ModelType.FREE, hasImageInput: true },
    [DEEPSEEK]: { type: ModelType.FREE, hasImageInput: false },
    [O3_MINI]: { type: ModelType.FREE, hasImageInput: false },
    [GPT_4o]: { type: ModelType.FREE, hasImageInput: true },
    [O1_MINI]: { type: ModelType.FREE, hasImageInput: false },
    [O1]: { type: ModelType.FREE, hasImageInput: false },
    [Claude_35_Sonnet]: { type: ModelType.FREE, hasImageInput: true },
    [Claude_35_Haiku]: { type: ModelType.FREE, hasImageInput: false },
    [DEEPSEEK_R1]: { type: ModelType.FREE, hasImageInput: false },

} as const

export function getModelAccess( model: string ) {
    const config = MODEL_CONFIG[model]
    if ( !config ) return null
    return config
}

export const validModel = ( model: string ): boolean => !!getModelAccess( model )

export const isProModel = ( model: string ): boolean => {
    const access = getModelAccess( model )
    return access?.type === ModelType.PRO
}

export const isPremiumModel = ( model: string ): boolean => {
    const access = getModelAccess( model )
    return access?.type === ModelType.PREMIUM
}

export const isImageInputModel = ( model: string ): boolean => {
    const access = getModelAccess( model )
    return !!access?.hasImageInput
}
