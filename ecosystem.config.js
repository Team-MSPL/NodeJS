module.exports = {
    apps: [
        {
            script: './src/server.js', // pm2로 실행될 파일 경로
            watch: true, // 파일이 변경되면 자동으로 재실행 (true || false)
            ignore_watch: [
                // 감지 제외할 것들
                'node_modules',
                'logs',
                '/home/ubuntu/danim_database/kkday_products_cache.json',
                '/home/ubuntu/danim_database/place_cache.json',
            ],
            node_args: '--max-old-space-size=4096',
            env: {
                NODE_ENV: 'development', // 개발환경시 적용될 설정 지정
            },
            env_production: {
                NODE_ENV: 'production', // 배포환경시 적용될 설정 지정
            },
        },
        // {
        //     script: './service-worker/',
        //     watch: ['./service-worker'],
        // },
    ],

    deploy: {
        production: {
            user: 'SSH_USERNAME',
            host: 'SSH_HOSTMACHINE',
            ref: 'origin/master',
            repo: 'GIT_REPOSITORY',
            path: 'DESTINATION_PATH',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
        },
    },
};
