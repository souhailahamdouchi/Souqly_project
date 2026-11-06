<?php

namespace App\Enums;

enum OrderStatus: string
{
    case EN_ATTENTE = 'EN_ATTENTE';
    case CONFIRMEE = 'CONFIRMEE';
    case EN_PREPARATION = 'EN_PREPARATION';
    case EXPEDIEE = 'EXPEDIEE';
    case LIVREE = 'LIVREE';
    case ANNULEE = 'ANNULEE';
    case REMBOURSEE = 'REMBOURSEE';
}
